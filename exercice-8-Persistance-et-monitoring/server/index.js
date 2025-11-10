/**
 * Serveur Todo App Temps Réel
 * Application de todo list collaborative avec Socket.IO, SQLite et monitoring
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

const database = require('./database');
const auth = require('./auth');
const { logger, metrics } = require('./logger');

// Configuration
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const MAX_TODOS_PER_USER = 50;
const MAX_TODO_LENGTH = 500;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting pour éviter les abus
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requetes par minute
  message: 'Trop de requêtes, veuillez réessayer plus tard'
});

app.use(limiter);

// ============================================
// ROUTES HTTP
// ============================================

/**
 * Route d'inscription
 * @summary Crée un nouveau compte utilisateur
 */
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation des données
    const validation = auth.validateRegistration(username, password);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Sanitisation du nom d'utilisateur
    const cleanUsername = validator.escape(username.trim());

    // Vérifier si l'utilisateur existe déja
    const existingUser = await database.getUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }

    // Hash du mot de passe
    const passwordHash = await auth.hashPassword(password);

    // Créer l'utilisateur
    const userId = await database.createUser(cleanUsername, passwordHash);

    // Générer un token
    const token = auth.generateToken({ id: userId, username: cleanUsername });

    // Sauvegarder la session
    await database.saveSession(userId, token);

    logger.info('Nouvel utilisateur enregistré', { userId, username: cleanUsername });

    res.json({
      success: true,
      token,
      user: { id: userId, username: cleanUsername }
    });

  } catch (error) {
    metrics.recordError(error, 'register');
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

/**
 * Route de connexion
 * @summary Authentifie un utilisateur existant
 */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }

    // Sanitisation
    const cleanUsername = validator.escape(username.trim());

    // Récupérer l'utilisateur
    const user = await database.getUserByUsername(cleanUsername);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Vérifier le mot de passe
    const validPassword = await auth.verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Générer un token
    const token = auth.generateToken({ id: user.id, username: user.username });

    // Sauvegarder la session
    await database.saveSession(user.id, token);

    logger.info('Utilisateur connecté', { userId: user.id, username: user.username });

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username }
    });

  } catch (error) {
    metrics.recordError(error, 'login');
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

/**
 * Route de test pour vérifier l'état du serveur
 * @summary Retourne les métriques actuelles
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    metrics: metrics.getMetrics()
  });
});

// ============================================
// WEBSOCKET - AUTHENTICATION MIDDLEWARE
// ============================================

io.use(auth.authenticateSocket);

// ============================================
// WEBSOCKET - GESTION DES CONNEXIONS
// ============================================

io.on('connection', async (socket) => {
  metrics.connectionOpened();
  
  logger.info('Client connecté', {
    socketId: socket.id,
    userId: socket.userId,
    username: socket.username
  });

  // Envoyer le nombre d'utilisateurs connectés à tous
  io.emit('users:count', io.engine.clientsCount);

  /**
   * Synchronisation initiale - envoie tous les todos de l'utilisateur
   */
  socket.on('todo:sync', async () => {
    try {
      metrics.messageReceived('todo:sync', socket.userId);
      
      const todos = await database.getTodosByUser(socket.userId);
      socket.emit('todo:list', todos);
      
      logger.debug('Synchronisation todos', {
        userId: socket.userId,
        count: todos.length
      });
    } catch (error) {
      metrics.recordError(error, 'todo:sync');
      socket.emit('error', { message: 'Erreur lors de la synchronisation' });
    }
  });

  /**
   * Créer un nouveau todo
   */
  socket.on('todo:create', async (data) => {
    try {
      metrics.messageReceived('todo:create', socket.userId);

      // Validation du texte
      if (!data.text || typeof data.text !== 'string') {
        return socket.emit('error', { message: 'Texte invalide' });
      }

      const text = data.text.trim();
      
      if (text.length === 0) {
        return socket.emit('error', { message: 'Le texte ne peut pas être vide' });
      }

      if (text.length > MAX_TODO_LENGTH) {
        return socket.emit('error', { 
          message: `Le texte ne peut pas dépasser ${MAX_TODO_LENGTH} caractères` 
        });
      }

      // Vérifier la limite de todos par utilisateur
      const todoCount = await database.countUserTodos(socket.userId);
      if (todoCount >= MAX_TODOS_PER_USER) {
        return socket.emit('error', { 
          message: `Vous ne pouvez pas avoir plus de ${MAX_TODOS_PER_USER} todos` 
        });
      }

      // Sanitisation contre XSS
      const cleanText = validator.escape(text);

      // Créer le todo
      const todo = await database.createTodo(socket.userId, cleanText);

      // Envoyer le nouveau todo à l'utilisateur
      socket.emit('todo:created', todo);

      logger.info('Todo créé', {
        userId: socket.userId,
        todoId: todo.id,
        text: cleanText.substring(0, 50)
      });

    } catch (error) {
      metrics.recordError(error, 'todo:create');
      socket.emit('error', { message: 'Erreur lors de la création' });
    }
  });

  /**
   * Mettre à jour un todo
   */
  socket.on('todo:update', async (data) => {
    try {
      metrics.messageReceived('todo:update', socket.userId);

      if (!data.id || typeof data.id !== 'number') {
        return socket.emit('error', { message: 'ID invalide' });
      }

      const updates = {};

      // Mise à jour du texte
      if (data.text !== undefined) {
        if (typeof data.text !== 'string') {
          return socket.emit('error', { message: 'Texte invalide' });
        }

        const text = data.text.trim();
        
        if (text.length === 0) {
          return socket.emit('error', { message: 'Le texte ne peut pas etre vide' });
        }

        if (text.length > MAX_TODO_LENGTH) {
          return socket.emit('error', { 
            message: `Le texte ne peut pas dépasser ${MAX_TODO_LENGTH} caractères` 
          });
        }

        updates.text = validator.escape(text);
      }

      // Mise à jour du statut completed
      if (data.completed !== undefined) {
        updates.completed = Boolean(data.completed);
      }

      // Mettre à jour en base
      const todo = await database.updateTodo(data.id, socket.userId, updates);

      if (!todo) {
        return socket.emit('error', { message: 'Todo introuvable' });
      }

      // Envoyer la mise à jour
      socket.emit('todo:updated', todo);

      logger.info('Todo mis à jour', {
        userId: socket.userId,
        todoId: data.id,
        updates: Object.keys(updates)
      });

    } catch (error) {
      metrics.recordError(error, 'todo:update');
      socket.emit('error', { message: 'Erreur lors de la mise à jour' });
    }
  });

  /**
   * Supprimer un todo
   */
  socket.on('todo:delete', async (data) => {
    try {
      metrics.messageReceived('todo:delete', socket.userId);

      if (!data.id || typeof data.id !== 'number') {
        return socket.emit('error', { message: 'ID invalide' });
      }

      const deleted = await database.deleteTodo(data.id, socket.userId);

      if (!deleted) {
        return socket.emit('error', { message: 'Todo introuvable' });
      }

      // Confirmer la suppression
      socket.emit('todo:deleted', { id: data.id });

      logger.info('Todo supprimé', {
        userId: socket.userId,
        todoId: data.id
      });

    } catch (error) {
      metrics.recordError(error, 'todo:delete');
      socket.emit('error', { message: 'Erreur lors de la suppression' });
    }
  });

  /**
   * Ping/Pong pour mesurer la latence
   */
  socket.on('ping', (timestamp) => {
    metrics.messageReceived('ping', socket.userId);
    socket.emit('pong', timestamp);
  });

  /**
   * Déconnexion
   */
  socket.on('disconnect', () => {
    metrics.connectionClosed();
    
    logger.info('Client déconnecté', {
      socketId: socket.id,
      userId: socket.userId
    });

    // Mettre à jour le compteur d'utilisateurs
    io.emit('users:count', io.engine.clientsCount);
  });
});

// ============================================
// DEMARRAGE DU SERVEUR
// ============================================

async function start() {
  try {
    // Initialiser la base de données
    await database.init();
    logger.info('Base de données initialisée');

    // Démarrer le serveur
    server.listen(PORT, () => {
      logger.info(`Serveur démarré sur le port ${PORT}`);
      console.log(`\n==============================================`);
      console.log(`  Todo App Temps Réel`);
      console.log(`  http://localhost:${PORT}`);
      console.log(`==============================================\n`);
    });

  } catch (error) {
    logger.error('Erreur lors du démarrage', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  logger.info('Arrêt du serveur...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Arrêt du serveur...');
  await database.close();
  process.exit(0);
});

// Lancer l'application
start();


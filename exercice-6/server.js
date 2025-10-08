const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration du serveur
let PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc1OTkzOTE1MSwiaWF0IjoxNzU5OTM5MTUxfQ';
const SALT_ROUNDS = 10;
const USERS_FILE = path.join(__dirname, 'users.json');

/**
 * Charge les utilisateurs depuis le fichier JSON
 * @returns {Promise<Array>} Liste des utilisateurs
 */
async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si le fichier n'existe pas ou est corrompu, retourner un tableau vide
        console.log('Fichier utilisateurs non trouvé, création d\'un nouveau fichier');
        return [];
    }
}

/**
 * Sauvegarde les utilisateurs dans le fichier JSON
 * @param {Array} users - Liste des utilisateurs à sauvegarder
 */
async function saveUsers(users) {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        console.log(`✅ ${users.length} utilisateur(s) sauvegardé(s)`);
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde des utilisateurs:', error);
        throw error;
    }
}

// Fonction pour trouver un port disponible
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                // Port occupé, essayer le suivant
                resolve(findAvailablePort(startPort + 1));
            } else {
                reject(err);
            }
        });
    });
}

// Middleware pour parser le JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variables globales (déclarées en haut pour la portée)

/**
 * Fonction utilitaire pour générer un nouvel ID unique pour les notes
 * @returns {number} L'ID généré
 */
function generateNoteId() {
    return noteIdCounter++;
}

/**
 * Fonction utilitaire pour générer un nouvel ID unique pour les utilisateurs
 * @returns {number} L'ID généré
 */
function generateUserId() {
    return userIdCounter++;
}

/**
 * Middleware pour vérifier l'authentification JWT
 * @param {Object} req - Objet de requête Express
 * @param {Object} res - Objet de réponse Express
 * @param {Function} next - Fonction next Express
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide ou expiré' });
        }
        req.user = user;
        next();
    });
}

/**
 * Fonction pour diffuser les notes mises à jour à tous les clients connectés
 */
function broadcastNotesUpdate() {
    io.emit('notes_updated', notes);
}

// Middleware d'authentification Socket.IO
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Token d\'authentification requis pour Socket.IO'));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error('Token invalide ou expiré'));
        }

        // Attacher les informations utilisateur au socket
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        next();
    });
});

// Configuration de Socket.IO
io.on('connection', (socket) => {
    console.log(`Utilisateur ${socket.username} (ID: ${socket.userId}) s'est connecté via Socket.IO:`, socket.id);

    // Envoyer les notes actuelles au nouveau client
    socket.emit('notes_updated', notes);

    // Événements Socket.IO pour modification/suppression directe (optionnel mais sécurisé)
    socket.on('edit_note', (data) => {
        handleSocketEditNote(socket, data);
    });

    socket.on('delete_note', (data) => {
        handleSocketDeleteNote(socket, data);
    });

    socket.on('disconnect', () => {
        console.log(`Utilisateur ${socket.username} s'est déconnecté:`, socket.id);
    });
});

/**
 * Gestionnaire d'événement Socket.IO pour l'édition de notes
 * @param {Object} socket - Socket client
 * @param {Object} data - Données { noteId, content }
 */
function handleSocketEditNote(socket, data) {
    try {
        const { noteId, content } = data;

        if (!noteId || !content || typeof content !== 'string' || content.trim().length === 0) {
            socket.emit('error', { message: 'Données invalides pour l\'édition' });
            return;
        }

        const noteIndex = notes.findIndex(note => note.id === parseInt(noteId));
        if (noteIndex === -1) {
            socket.emit('error', { message: 'Note non trouvée' });
            return;
        }

        // Vérifier que l'utilisateur est le propriétaire
        if (notes[noteIndex].authorId !== socket.userId) {
            socket.emit('error', { message: 'Vous ne pouvez modifier que vos propres notes' });
            return;
        }

        // Mettre à jour la note
        notes[noteIndex] = {
            ...notes[noteIndex],
            content: content.trim(),
            updatedAt: new Date().toISOString()
        };

        // Diffuser la mise à jour à tous les clients
        broadcastNotesUpdate();

        // Confirmer la modification au client
        socket.emit('note_edited', { noteId: parseInt(noteId), success: true });

    } catch (error) {
        console.error('Erreur lors de l\'édition Socket.IO:', error);
        socket.emit('error', { message: 'Erreur lors de l\'édition de la note' });
    }
}

/**
 * Gestionnaire d'événement Socket.IO pour la suppression de notes
 * @param {Object} socket - Socket client
 * @param {Object} data - Données { noteId }
 */
function handleSocketDeleteNote(socket, data) {
    try {
        const { noteId } = data;

        if (!noteId) {
            socket.emit('error', { message: 'ID de note requis' });
            return;
        }

        const noteIndex = notes.findIndex(note => note.id === parseInt(noteId));
        if (noteIndex === -1) {
            socket.emit('error', { message: 'Note non trouvée' });
            return;
        }

        // Vérifier que l'utilisateur est le propriétaire
        if (notes[noteIndex].authorId !== socket.userId) {
            socket.emit('error', { message: 'Vous ne pouvez supprimer que vos propres notes' });
            return;
        }

        // Supprimer la note
        const deletedNote = notes.splice(noteIndex, 1)[0];

        // Diffuser la mise à jour à tous les clients
        broadcastNotesUpdate();

        // Confirmer la suppression au client
        socket.emit('note_deleted', { noteId: parseInt(noteId), success: true });

    } catch (error) {
        console.error('Erreur lors de la suppression Socket.IO:', error);
        socket.emit('error', { message: 'Erreur lors de la suppression de la note' });
    }
}

// Routes API REST pour l'authentification

/**
 * POST /register - Inscription d'un nouvel utilisateur
 * Corps de la requête: { username: string, password: string }
 */
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation des données
        if (!username || !password) {
            return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = users.find(user => user.username === username);
        if (existingUser) {
            return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
        }

        // Hacher le mot de passe
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Créer le nouvel utilisateur
        const newUser = {
            id: generateUserId(),
            username: username,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        // Ajouter à la liste des utilisateurs
        users.push(newUser);

        // Sauvegarder les utilisateurs dans le fichier
        await saveUsers(users);

        // Générer un JWT
        const token = jwt.sign(
            { userId: newUser.id, username: newUser.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Utilisateur créé avec succès',
            token: token,
            user: {
                id: newUser.id,
                username: newUser.username,
                createdAt: newUser.createdAt
            }
        });

    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

/**
 * POST /login - Connexion d'un utilisateur
 * Corps de la requête: { username: string, password: string }
 */
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation des données
        if (!username || !password) {
            return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
        }

        // Trouver l'utilisateur
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        // Générer un JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Connexion réussie',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Routes API REST pour les notes

/**
 * GET /notes - Retourne toutes les notes
 * Retourne un tableau de toutes les notes stockées en mémoire
 */
app.get('/notes', (req, res) => {
    res.json(notes);
});

/**
 * POST /notes - Ajoute une nouvelle note
 * Corps de la requête: { content: string }
 * Nécessite une authentification JWT
 */
app.post('/notes', authenticateToken, (req, res) => {
    try {
        const { content } = req.body;

        // Validation basique
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ error: 'Le contenu de la note est requis et doit être une chaîne non vide' });
        }

        // Créer la nouvelle note avec l'ID de l'utilisateur authentifié
        const newNote = {
            id: generateNoteId(),
            content: content.trim(),
            authorId: req.user.userId,
            authorUsername: req.user.username,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Ajouter à la liste des notes
        notes.push(newNote);

        // Diffuser la mise à jour à tous les clients connectés
        broadcastNotesUpdate();

        res.status(201).json(newNote);
    } catch (error) {
        console.error('Erreur lors de la création de la note:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

/**
 * PUT /notes/:id - Met à jour une note existante
 * Paramètre URL: id (number)
 * Corps de la requête: { content: string }
 * Nécessite une authentification JWT
 */
app.put('/notes/:id', authenticateToken, (req, res) => {
    try {
        const noteId = parseInt(req.params.id);
        const { content } = req.body;

        // Validation
        if (isNaN(noteId)) {
            return res.status(400).json({ error: 'ID de note invalide' });
        }

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ error: 'Le contenu de la note est requis et doit être une chaîne non vide' });
        }

        // Trouver la note
        const noteIndex = notes.findIndex(note => note.id === noteId);
        if (noteIndex === -1) {
            return res.status(404).json({ error: 'Note non trouvée' });
        }

        // Vérifier que l'utilisateur est le propriétaire de la note
        if (notes[noteIndex].authorId !== req.user.userId) {
            return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres notes' });
        }

        // Mettre à jour la note
        notes[noteIndex] = {
            ...notes[noteIndex],
            content: content.trim(),
            updatedAt: new Date().toISOString()
        };

        // Diffuser la mise à jour
        broadcastNotesUpdate();

        res.json(notes[noteIndex]);
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la note:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

/**
 * DELETE /notes/:id - Supprime une note
 * Paramètre URL: id (number)
 * Nécessite une authentification JWT
 */
app.delete('/notes/:id', authenticateToken, (req, res) => {
    try {
        const noteId = parseInt(req.params.id);

        // Validation
        if (isNaN(noteId)) {
            return res.status(400).json({ error: 'ID de note invalide' });
        }

        // Trouver et supprimer la note
        const noteIndex = notes.findIndex(note => note.id === noteId);
        if (noteIndex === -1) {
            return res.status(404).json({ error: 'Note non trouvée' });
        }

        // Vérifier que l'utilisateur est le propriétaire de la note
        if (notes[noteIndex].authorId !== req.user.userId) {
            return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres notes' });
        }

        const deletedNote = notes.splice(noteIndex, 1)[0];

        // Diffuser la mise à jour
        broadcastNotesUpdate();

        res.json({ message: 'Note supprimée avec succès', deletedNote });
    } catch (error) {
        console.error('Erreur lors de la suppression de la note:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Variables globales (déclarées en haut pour la portée)
let users;
let notes;
let noteIdCounter;
let userIdCounter;

// Démarrage du serveur avec gestion automatique du port
async function startServer() {
    try {
        // Initialiser les variables globales
        notes = [];
        noteIdCounter = 1;

        // Charger les utilisateurs depuis le fichier
        users = await loadUsers();
        userIdCounter = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;

        console.log(`📁 ${users.length} utilisateur(s) chargé(s) depuis le fichier`);

        // Trouver un port disponible
        PORT = await findAvailablePort(PORT);
        console.log(`Port disponible trouvé : ${PORT}`);

        // Démarrer le serveur sur ce port
        server.listen(PORT, () => {
            console.log(`✅ Serveur démarré avec succès sur le port ${PORT}`);
            console.log(`🌐 Interface accessible à http://localhost:${PORT}`);
            console.log(`💡 Appuyez sur Ctrl+C pour arrêter le serveur`);
        });

        server.on('error', (err) => {
            console.error('❌ Erreur lors du démarrage du serveur:', err.message);
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Impossible de trouver un port disponible:', error.message);
        process.exit(1);
    }
}

// Démarrer le serveur
startServer();

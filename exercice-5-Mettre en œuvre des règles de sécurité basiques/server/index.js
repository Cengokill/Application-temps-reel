/**
 * Tableau de Bord Collaboratif - Serveur
 * Application de notes collaboratives avec authentification JWT et Socket.IO
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Configuration
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise_changez_moi_en_production';
const SALT_ROUNDS = 10;

// Chemins des fichiers de persistance
const USERS_FILE = path.join(__dirname, 'users.json');
const NOTES_FILE = path.join(__dirname, 'notes.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Variables globales pour le stockage en mémoire
let users = [];
let notes = [];
let userIdCounter = 1;
let noteIdCounter = 1;

// ============================================
// FONCTIONS DE PERSISTANCE
// ============================================

/**
 * Charge les utilisateurs depuis le fichier JSON
 * @returns {Promise<Array>} Liste des utilisateurs
 */
async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        const loadedUsers = JSON.parse(data);
        console.log(`📁 ${loadedUsers.length} utilisateur(s) chargé(s)`);
        return loadedUsers;
    } catch (error) {
        console.log('📁 Aucun utilisateur existant, démarrage avec une base vide');
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

/**
 * Charge les notes depuis le fichier JSON
 * @returns {Promise<Array>} Liste des notes
 */
async function loadNotes() {
    try {
        const data = await fs.readFile(NOTES_FILE, 'utf8');
        const loadedNotes = JSON.parse(data);
        console.log(`📝 ${loadedNotes.length} note(s) chargée(s)`);
        return loadedNotes;
    } catch (error) {
        console.log('📝 Aucune note existante, démarrage avec une base vide');
        return [];
    }
}

/**
 * Sauvegarde les notes dans le fichier JSON
 * @param {Array} notes - Liste des notes à sauvegarder
 */
async function saveNotes(notes) {
    try {
        await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
        console.log(`✅ ${notes.length} note(s) sauvegardée(s)`);
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde des notes:', error);
        throw error;
    }
}

// ============================================
// MIDDLEWARE D'AUTHENTIFICATION
// ============================================

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

// ============================================
// ROUTES D'AUTHENTIFICATION
// ============================================

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
            id: userIdCounter++,
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

        console.log(`✅ Nouvel utilisateur inscrit: ${username}`);

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
        console.error('❌ Erreur lors de l\'inscription:', error);
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

        console.log(`✅ Utilisateur connecté: ${username}`);

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
        console.error('❌ Erreur lors de la connexion:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ============================================
// ROUTES API DES NOTES
// ============================================

/**
 * GET /notes - Retourne toutes les notes
 * Accessible sans authentification (lecture publique)
 */
app.get('/notes', (req, res) => {
    res.json(notes);
});

/**
 * POST /notes - Ajoute une nouvelle note
 * Corps de la requête: { content: string }
 * Nécessite une authentification JWT
 */
app.post('/notes', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;

        // Validation basique
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ error: 'Le contenu de la note est requis et doit être une chaîne non vide' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ error: 'Le contenu de la note ne peut pas dépasser 1000 caractères' });
        }

        // Créer la nouvelle note avec l'ID de l'utilisateur authentifié
        const newNote = {
            id: noteIdCounter++,
            content: content.trim(),
            authorId: req.user.userId,
            authorUsername: req.user.username,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Ajouter à la liste des notes
        notes.push(newNote);

        // Sauvegarder les notes
        await saveNotes(notes);

        // Diffuser la mise à jour à tous les clients connectés
        io.emit('notes_updated', notes);

        console.log(`✅ Nouvelle note créée par ${req.user.username}`);

        res.status(201).json(newNote);
    } catch (error) {
        console.error('❌ Erreur lors de la création de la note:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

/**
 * PUT /notes/:id - Met à jour une note existante
 * Paramètre URL: id (number)
 * Corps de la requête: { content: string }
 * Nécessite une authentification JWT et vérification de propriété
 */
app.put('/notes/:id', authenticateToken, async (req, res) => {
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

        if (content.length > 1000) {
            return res.status(400).json({ error: 'Le contenu de la note ne peut pas dépasser 1000 caractères' });
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

        // Sauvegarder les notes
        await saveNotes(notes);

        // Diffuser la mise à jour
        io.emit('notes_updated', notes);

        console.log(`✅ Note ${noteId} modifiée par ${req.user.username}`);

        res.json(notes[noteIndex]);
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour de la note:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

/**
 * DELETE /notes/:id - Supprime une note
 * Paramètre URL: id (number)
 * Nécessite une authentification JWT et vérification de propriété
 */
app.delete('/notes/:id', authenticateToken, async (req, res) => {
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

        // Sauvegarder les notes
        await saveNotes(notes);

        // Diffuser la mise à jour
        io.emit('notes_updated', notes);

        console.log(`✅ Note ${noteId} supprimée par ${req.user.username}`);

        res.json({ message: 'Note supprimée avec succès', deletedNote });
    } catch (error) {
        console.error('❌ Erreur lors de la suppression de la note:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ============================================
// CONFIGURATION SOCKET.IO
// ============================================

/**
 * Middleware d'authentification Socket.IO
 */
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

/**
 * Gestion des connexions Socket.IO
 */
io.on('connection', (socket) => {
    console.log(`🔌 ${socket.username} (ID: ${socket.userId}) connecté via Socket.IO`);

    // Envoyer les notes actuelles au nouveau client
    socket.emit('notes_updated', notes);

    // Événements Socket.IO optionnels pour des opérations directes
    socket.on('request_notes', () => {
        socket.emit('notes_updated', notes);
    });

    socket.on('disconnect', () => {
        console.log(`👋 ${socket.username} déconnecté`);
    });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

/**
 * Initialise et démarre le serveur
 */
async function startServer() {
    try {
        // Charger les données persistées
        users = await loadUsers();
        notes = await loadNotes();

        // Initialiser les compteurs d'ID
        userIdCounter = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
        noteIdCounter = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;

        console.log(`🔢 Compteur utilisateurs: ${userIdCounter}, Compteur notes: ${noteIdCounter}`);

        // Démarrer le serveur HTTP
        server.listen(PORT, () => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🚀 Serveur Tableau de Bord Collaboratif');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📡 Port: ${PORT}`);
            console.log(`🌐 URL: http://localhost:${PORT}`);
            console.log(`👥 Utilisateurs: ${users.length}`);
            console.log(`📝 Notes: ${notes.length}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ Prêt à recevoir des connexions !');
        });

    } catch (error) {
        console.error('❌ Erreur lors du démarrage du serveur:', error);
        process.exit(1);
    }
}

/**
 * Gestion de l'arrêt propre du serveur
 */
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    
    try {
        await saveUsers(users);
        await saveNotes(notes);
        console.log('✅ Données sauvegardées');
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde finale:', error);
    }
    
    process.exit(0);
});

// Démarrer le serveur
startServer();


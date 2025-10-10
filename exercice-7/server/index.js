/**
 * Éditeur Collaboratif Temps Réel - Serveur
 * Serveur Express + Socket.IO avec Redis Adapter et authentification par token
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const validator = require('validator');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Configuration
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const VALID_TOKEN = process.env.EDITOR_TOKEN || 'secret123';

// Limites
const MAX_USERNAME_LENGTH = 20;
const MAX_EDITOR_LENGTH = 50000;

// Configuration Rate Limiting
const RATE_LIMIT_CONFIG = {
    // Limites par socket
    SOCKET_EVENTS_PER_SECOND: 10,
    SOCKET_EVENTS_PER_MINUTE: 300,
    
    // Limites par IP
    IP_REQUESTS_PER_MINUTE: 100,
    IP_REQUESTS_PER_HOUR: 1000,
    
    // Limites spécifiques par événement
    EDITOR_UPDATES_PER_SECOND: 5,
    CURSOR_UPDATES_PER_SECOND: 20,
    
    // Seuils d'abus
    ABUSE_THRESHOLD: 50, // événements/seconde pour déclencher la déconnexion
    ABUSE_WINDOW: 10000, // fenêtre de 10 secondes
};

// Variables globales
let redisPubClient = null;
let redisSubClient = null;
let eventCounter = 0;
let startTime = Date.now();

// Créer l'application Express
const app = express();
const httpServer = createServer(app);

// Configuration sécurité avec Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Configuration CORS
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST']
}));

// Rate limiting global
const globalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: RATE_LIMIT_CONFIG.IP_REQUESTS_PER_HOUR,
    message: {
        error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`⚠️ Rate limit global dépassé pour IP: ${req.ip}`);
        res.status(429).json({
            error: 'Trop de requêtes depuis cette IP',
            retryAfter: '15 minutes'
        });
    }
});

// Rate limiting pour les routes API
const apiRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: RATE_LIMIT_CONFIG.IP_REQUESTS_PER_MINUTE,
    message: {
        error: 'Trop de requêtes API, veuillez réessayer dans une minute.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`⚠️ Rate limit API dépassé pour IP: ${req.ip}`);
        res.status(429).json({
            error: 'Trop de requêtes API',
            retryAfter: '1 minute'
        });
    }
});

// Appliquer les rate limits
app.use(globalRateLimit);
app.use('/status', apiRateLimit);
app.use('/monitor', apiRateLimit);

// Configuration Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST']
    }
});

// Stockage en mémoire
const usersByRoom = new Map(); // room -> [{ username, color, socketId }]
const editorContentByRoom = new Map(); // room -> content
const userSockets = new Map(); // username -> socket
const roomStats = new Map(); // room -> { users: number, events: number }

// Rate limiting et sécurité
const socketEventCounters = new Map(); // socketId -> { events: [], lastCleanup: timestamp }
const ipRequestCounters = new Map(); // ip -> { requests: [], lastCleanup: timestamp }
const abuseDetected = new Set(); // socketIds des clients abusifs détectés

// Couleurs disponibles pour les utilisateurs
const availableColors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
    '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f',
    '#a8edea', '#fed6e3', '#d299c2', '#fad0c4', '#ffd1ff'
];

/**
 * Génère une couleur aléatoire pour un utilisateur
 */
function getRandomColor() {
    return availableColors[Math.floor(Math.random() * availableColors.length)];
}

/**
 * Valide et sanitiser les données utilisateur
 */
function validateUserData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Données invalides' };
    }
    
    if (typeof data.username !== 'string' || !data.username.trim()) {
        return { valid: false, error: 'Nom d\'utilisateur requis' };
    }
    
    if (typeof data.room !== 'string' || !data.room.trim()) {
        return { valid: false, error: 'Room requise' };
    }
    
    // Sanitiser le nom d'utilisateur
    const sanitizedUsername = validator.escape(data.username.trim());
    
    if (sanitizedUsername.length < 2) {
        return { valid: false, error: 'Le nom d\'utilisateur doit contenir au moins 2 caractères' };
    }
    
    if (sanitizedUsername.length > MAX_USERNAME_LENGTH) {
        return { valid: false, error: `Le nom d'utilisateur ne peut pas dépasser ${MAX_USERNAME_LENGTH} caractères` };
    }
    
    return {
        valid: true,
        sanitizedData: {
            username: sanitizedUsername,
            room: validator.escape(data.room.trim())
        }
    };
}

/**
 * Valide les données de l'éditeur
 */
function validateEditorData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Données invalides' };
    }
    
    if (typeof data.username !== 'string' || !data.username.trim()) {
        return { valid: false, error: 'Nom d\'utilisateur requis' };
    }
    
    if (typeof data.room !== 'string' || !data.room.trim()) {
        return { valid: false, error: 'Room requise' };
    }
    
    if (typeof data.position !== 'number' || data.position < 0) {
        return { valid: false, error: 'Position invalide' };
    }
    
    if (typeof data.deletedLength !== 'number' || data.deletedLength < 0) {
        return { valid: false, error: 'Longueur de suppression invalide' };
    }
    
    if (!['insert', 'delete', 'replace'].includes(data.type)) {
        return { valid: false, error: 'Type de modification invalide' };
    }
    
    // Sanitiser le texte
    const sanitizedText = validator.escape(data.text || '');
    
    if (sanitizedText.length > MAX_EDITOR_LENGTH) {
        return { valid: false, error: `Texte trop long (max ${MAX_EDITOR_LENGTH} caractères)` };
    }
    
    return {
        valid: true,
        sanitizedData: {
            ...data,
            text: sanitizedText,
            username: validator.escape(data.username.trim()),
            room: validator.escape(data.room.trim())
        }
    };
}

/**
 * Valide et sanitiser les données de message (pour chat si implémenté)
 */
function validateMessageData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Données invalides' };
    }
    
    if (typeof data.message !== 'string' || !data.message.trim()) {
        return { valid: false, error: 'Message requis' };
    }
    
    // Sanitiser le message
    const sanitizedMessage = validator.escape(data.message.trim());
    
    if (sanitizedMessage.length > 1000) {
        return { valid: false, error: 'Message trop long (max 1000 caractères)' };
    }
    
    // Vérifier les patterns suspects
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
        /document\./i,
        /window\./i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(sanitizedMessage))) {
        return { valid: false, error: 'Contenu suspect détecté' };
    }
    
    return {
        valid: true,
        sanitizedData: {
            ...data,
            message: sanitizedMessage
        }
    };
}

/**
 * Nettoie les compteurs d'événements expirés
 */
function cleanupEventCounters(counters, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;
    
    // Nettoyer les événements expirés
    counters.events = counters.events.filter(timestamp => timestamp > cutoff);
    
    // Marquer comme nettoyé
    counters.lastCleanup = now;
}

/**
 * Vérifie si un socket dépasse les limites de rate limiting
 */
function checkSocketRateLimit(socketId, eventType = 'general') {
    const now = Date.now();
    const counters = socketEventCounters.get(socketId) || { events: [], lastCleanup: now };
    
    // Nettoyer les anciens événements si nécessaire
    if (now - counters.lastCleanup > 1000) { // Nettoyer toutes les secondes
        cleanupEventCounters(counters, 60000); // Fenêtre de 1 minute
    }
    
    // Ajouter l'événement actuel
    counters.events.push(now);
    socketEventCounters.set(socketId, counters);
    
    // Vérifier les limites par type d'événement
    const recentEvents = counters.events.filter(timestamp => timestamp > now - 1000); // Dernière seconde
    
    let limit;
    switch (eventType) {
        case 'editor_update':
            limit = RATE_LIMIT_CONFIG.EDITOR_UPDATES_PER_SECOND;
            break;
        case 'cursor_position':
            limit = RATE_LIMIT_CONFIG.CURSOR_UPDATES_PER_SECOND;
            break;
        default:
            limit = RATE_LIMIT_CONFIG.SOCKET_EVENTS_PER_SECOND;
    }
    
    if (recentEvents.length > limit) {
        console.warn(`⚠️ Rate limit dépassé pour socket ${socketId}: ${recentEvents.length}/${limit} événements/seconde`);
        return false;
    }
    
    // Vérifier le seuil d'abus
    const abuseWindowEvents = counters.events.filter(timestamp => timestamp > now - RATE_LIMIT_CONFIG.ABUSE_WINDOW);
    if (abuseWindowEvents.length > RATE_LIMIT_CONFIG.ABUSE_THRESHOLD) {
        console.error(`🚨 Abus détecté pour socket ${socketId}: ${abuseWindowEvents.length} événements en ${RATE_LIMIT_CONFIG.ABUSE_WINDOW/1000}s`);
        abuseDetected.add(socketId);
        return false;
    }
    
    return true;
}

/**
 * Vérifie si une IP dépasse les limites de rate limiting
 */
function checkIPRateLimit(ip) {
    const now = Date.now();
    const counters = ipRequestCounters.get(ip) || { requests: [], lastCleanup: now };
    
    // Nettoyer les anciennes requêtes si nécessaire
    if (now - counters.lastCleanup > 60000) { // Nettoyer toutes les minutes
        cleanupEventCounters(counters, 3600000); // Fenêtre de 1 heure
    }
    
    // Ajouter la requête actuelle
    counters.requests.push(now);
    ipRequestCounters.set(ip, counters);
    
    // Vérifier les limites par minute
    const recentRequests = counters.requests.filter(timestamp => timestamp > now - 60000);
    if (recentRequests.length > RATE_LIMIT_CONFIG.IP_REQUESTS_PER_MINUTE) {
        console.warn(`⚠️ Rate limit IP dépassé pour ${ip}: ${recentRequests.length}/${RATE_LIMIT_CONFIG.IP_REQUESTS_PER_MINUTE} requêtes/minute`);
        return false;
    }
    
    return true;
}

/**
 * Déconnecte un socket abusif
 */
function disconnectAbusiveSocket(socket, reason) {
    console.error(`🚨 Déconnexion d'un client abusif: ${socket.id} - ${reason}`);
    
    // Notifier le client
    socket.emit('error', {
        message: 'Connexion fermée pour abus détecté',
        type: 'abuse_detected',
        reason: reason
    });
    
    // Déconnecter après un court délai
    setTimeout(() => {
        socket.disconnect(true);
    }, 1000);
}

/**
 * Initialise Redis Adapter
 */
async function initializeRedis() {
    try {
        // Créer les clients Redis
        redisPubClient = createClient({ url: REDIS_URL });
        redisSubClient = redisPubClient.duplicate();
        
        // Configurer les gestionnaires d'erreurs
        redisPubClient.on('error', (err) => {
            console.error('❌ Erreur Redis Publisher:', err);
        });
        
        redisSubClient.on('error', (err) => {
            console.error('❌ Erreur Redis Subscriber:', err);
        });
        
        // Connecter les clients
        await redisPubClient.connect();
        await redisSubClient.connect();
        
        // Configurer l'adapter Socket.IO
        io.adapter(createAdapter(redisPubClient, redisSubClient));
        
        console.log('✅ Redis Adapter initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation Redis:', error);
        console.log('💡 L\'application continuera sans Redis. Les messages resteront locaux à cette instance.');
    }
}

/**
 * Middleware d'authentification Socket.IO avec rate limiting
 */
io.use((socket, next) => {
    const token = socket.handshake.query.token;
    const clientIP = socket.handshake.address;
    
    // Vérifier le token
    if (token !== VALID_TOKEN) {
        console.log('❌ Token invalide pour:', socket.id);
        return next(new Error('Token d\'authentification invalide'));
    }
    
    // Vérifier le rate limiting IP
    if (!checkIPRateLimit(clientIP)) {
        console.log('❌ Rate limit IP dépassé pour:', clientIP);
        return next(new Error('Trop de connexions depuis cette IP'));
    }
    
    // Vérifier si l'IP est déjà marquée comme abusive
    if (abuseDetected.has(socket.id)) {
        console.log('❌ Socket abusif détecté:', socket.id);
        return next(new Error('Connexion refusée - abus détecté'));
    }
    
    console.log('✅ Token valide et rate limit OK pour:', socket.id);
    next();
});

/**
 * Gère les connexions Socket.IO
 */
io.on('connection', (socket) => {
    console.log('🔌 Nouvelle connexion:', socket.id);
    eventCounter++;
    
    // Connexion d'un utilisateur
    socket.on('user_connected', (data) => {
        console.log('👤 Tentative de connexion utilisateur:', data);
        
        // Valider les données
        const validation = validateUserData(data);
        if (!validation.valid) {
            socket.emit('error', { 
                message: validation.error,
                type: 'validation_error'
            });
            return;
        }
        
        const { username, room } = validation.sanitizedData;
        
        // Vérifier si le nom d'utilisateur est déjà utilisé
        if (userSockets.has(username)) {
            socket.emit('error', {
                message: `Le nom d'utilisateur "${username}" est déjà utilisé`,
                type: 'username_taken'
            });
            return;
        }
        
        // Attribuer une couleur à l'utilisateur
        const color = getRandomColor();
        
        // Stocker les informations
        socket.username = username;
        socket.room = room;
        socket.color = color;
        
        // Rejoindre la room
        socket.join(room);
        
        // Ajouter l'utilisateur à la room
        if (!usersByRoom.has(room)) {
            usersByRoom.set(room, []);
            editorContentByRoom.set(room, '');
            roomStats.set(room, { users: 0, events: 0 });
        }
        
        const roomUsers = usersByRoom.get(room);
        roomUsers.push({ username, color, socketId: socket.id });
        usersByRoom.set(room, roomUsers);
        
        // Mettre à jour les statistiques
        const stats = roomStats.get(room);
        stats.users = roomUsers.length;
        roomStats.set(room, stats);
        
        // Stocker le socket pour les utilisateurs
        userSockets.set(username, socket);
        
        console.log(`✅ ${username} connecté à la room ${room} avec la couleur ${color}`);
        
        // Confirmer la connexion
        socket.emit('user_connected_success', {
            username,
            room,
            color
        });
        
        // Notifier les autres utilisateurs
        socket.to(room).emit('notification', {
            type: 'user_joined',
            username,
            color
        });
        
        // Envoyer la liste des utilisateurs
        broadcastUsersList(room);
        
        // Synchroniser l'éditeur
        const roomContent = editorContentByRoom.get(room) || '';
        socket.emit('editor_sync', { content: roomContent });
    });
    
    // Mise à jour de l'éditeur
    socket.on('editor_update', (data) => {
        console.log('📝 Mise à jour éditeur:', data);
        
        // Vérifier le rate limiting
        if (!checkSocketRateLimit(socket.id, 'editor_update')) {
            disconnectAbusiveSocket(socket, 'Rate limit éditeur dépassé');
            return;
        }
        
        if (!socket.room) {
            socket.emit('error', { message: 'Room non assignée' });
            return;
        }
        
        // Valider les données
        const validation = validateEditorData(data);
        if (!validation.valid) {
            socket.emit('error', { message: validation.error });
            return;
        }
        
        const sanitizedData = validation.sanitizedData;
        
        // Appliquer le changement au contenu de la room
        const currentContent = editorContentByRoom.get(socket.room) || '';
        const beforeChange = currentContent.substring(0, sanitizedData.position);
        const afterChange = currentContent.substring(sanitizedData.position + sanitizedData.deletedLength);
        const newContent = beforeChange + sanitizedData.text + afterChange;
        
        // Vérifier la limite de longueur
        if (newContent.length > MAX_EDITOR_LENGTH) {
            socket.emit('error', { message: `Contenu trop long (max ${MAX_EDITOR_LENGTH} caractères)` });
            return;
        }
        
        // Mettre à jour le contenu
        editorContentByRoom.set(socket.room, newContent);
        
        // Mettre à jour les statistiques
        const stats = roomStats.get(socket.room);
        stats.events++;
        roomStats.set(socket.room, stats);
        eventCounter++;
        
        // Diffuser la mise à jour aux autres utilisateurs de la room
        socket.to(socket.room).emit('editor_update', {
            ...sanitizedData,
            color: socket.color
        });
        
        console.log(`📝 Mise à jour éditeur diffusée dans ${socket.room}`);
    });
    
    // Position du curseur
    socket.on('cursor_position', (data) => {
        // Vérifier le rate limiting
        if (!checkSocketRateLimit(socket.id, 'cursor_position')) {
            disconnectAbusiveSocket(socket, 'Rate limit curseur dépassé');
            return;
        }
        
        if (!socket.room) return;
        
        // Diffuser la position du curseur aux autres utilisateurs
        socket.to(socket.room).emit('cursor_position', {
            username: data.username,
            position: data.position,
            color: socket.color
        });
    });
    
    // Demande de synchronisation
    socket.on('editor_sync_request', (data) => {
        const roomContent = editorContentByRoom.get(data.room) || '';
        socket.emit('editor_sync', { content: roomContent });
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
        console.log('🔌 Déconnexion:', socket.id);
        
        // Nettoyer les compteurs de rate limiting
        socketEventCounters.delete(socket.id);
        abuseDetected.delete(socket.id);
        
        if (socket.username && socket.room) {
            const room = socket.room;
            const username = socket.username;
            
            // Retirer l'utilisateur de la room
            const roomUsers = usersByRoom.get(room);
            if (roomUsers) {
                const index = roomUsers.findIndex(user => user.username === username);
                if (index > -1) {
                    roomUsers.splice(index, 1);
                    usersByRoom.set(room, roomUsers);
                    
                    // Mettre à jour les statistiques
                    const stats = roomStats.get(room);
                    stats.users = roomUsers.length;
                    roomStats.set(room, stats);
                }
            }
            
            // Supprimer le socket des utilisateurs
            userSockets.delete(username);
            
            // Notifier les autres utilisateurs
            socket.to(room).emit('notification', {
                type: 'user_left',
                username,
                color: socket.color
            });
            
            // Diffuser la liste mise à jour
            broadcastUsersList(room);
            
            console.log(`👋 ${username} déconnecté de la room ${room}`);
        }
    });
});

/**
 * Diffuse la liste des utilisateurs d'une room
 */
function broadcastUsersList(room) {
    const roomUsers = usersByRoom.get(room) || [];
    const usersWithColors = roomUsers.map(user => ({
        username: user.username,
        color: user.color
    }));
    
    io.to(room).emit('users_list', usersWithColors);
}

/**
 * Nettoie périodiquement les compteurs de rate limiting
 */
function periodicCleanup() {
    const now = Date.now();
    
    // Nettoyer les compteurs de sockets expirés
    for (const [socketId, counters] of socketEventCounters.entries()) {
        if (now - counters.lastCleanup > 300000) { // 5 minutes
            socketEventCounters.delete(socketId);
        }
    }
    
    // Nettoyer les compteurs d'IP expirés
    for (const [ip, counters] of ipRequestCounters.entries()) {
        if (now - counters.lastCleanup > 3600000) { // 1 heure
            ipRequestCounters.delete(ip);
        }
    }
    
    // Nettoyer les abus détectés anciens
    if (abuseDetected.size > 1000) {
        abuseDetected.clear();
        console.log('🧹 Nettoyage des abus détectés');
    }
}

// Nettoyage périodique toutes les 5 minutes
setInterval(periodicCleanup, 5 * 60 * 1000);

/**
 * Route de monitoring avec statistiques de sécurité
 */
app.get('/status', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const eventsPerMinute = Math.floor((eventCounter / uptime) * 60) || 0;
    
    const rooms = Array.from(roomStats.entries()).map(([room, stats]) => ({
        name: room,
        users: stats.users,
        events: stats.events
    }));
    
    const totalUsers = Array.from(roomStats.values()).reduce((sum, stats) => sum + stats.users, 0);
    
    // Statistiques de sécurité
    const securityStats = {
        activeSocketCounters: socketEventCounters.size,
        activeIPCounters: ipRequestCounters.size,
        abuseDetectedCount: abuseDetected.size,
        rateLimitConfig: RATE_LIMIT_CONFIG
    };
    
    res.json({
        status: 'online',
        uptime: uptime,
        totalConnections: io.engine.clientsCount,
        totalUsers: totalUsers,
        eventsPerMinute: eventsPerMinute,
        totalEvents: eventCounter,
        rooms: rooms,
        security: securityStats,
        timestamp: new Date().toISOString()
    });
});

/**
 * Page de monitoring HTML
 */
app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/monitor.html'));
});

/**
 * Servir les fichiers statiques du client
 */
app.use('/client', express.static(path.join(__dirname, '../client')));

/**
 * Route racine - rediriger vers le client
 */
app.get('/', (req, res) => {
    res.redirect('/client/index.html');
});

/**
 * Démarre le serveur
 */
async function startServer() {
    try {
        // Initialiser Redis
        await initializeRedis();
        
        // Démarrer le serveur HTTP
        httpServer.listen(PORT, () => {
            console.log('🚀 Serveur démarré sur le port', PORT);
            console.log('🔑 Token d\'authentification:', VALID_TOKEN);
            console.log('📊 Monitoring: http://localhost:' + PORT + '/monitor');
            console.log('🌐 Client: http://localhost:' + PORT + '/client/index.html');
            console.log('✅ Prêt à recevoir des connexions !');
        });
    } catch (error) {
        console.error('❌ Erreur lors du démarrage du serveur:', error);
        process.exit(1);
    }
}

/**
 * Gestion des erreurs du serveur
 */
httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Erreur: Le port ${PORT} est déjà utilisé.`);
        console.error('💡 Solution: Arrêtez le processus existant ou changez le port.');
        process.exit(1);
    } else {
        console.error('❌ Erreur du serveur:', error);
        process.exit(1);
    }
});

/**
 * Gestion de l'arrêt propre du serveur
 */
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    
    // Fermer les connexions Redis
    if (redisPubClient) {
        await redisPubClient.quit();
        console.log('✅ Connexion Redis Publisher fermée');
    }
    if (redisSubClient) {
        await redisSubClient.quit();
        console.log('✅ Connexion Redis Subscriber fermée');
    }
    
    // Fermer le serveur HTTP
    httpServer.close(() => {
        console.log('✅ Serveur HTTP arrêté proprement');
        process.exit(0);
    });
});

// Démarrer le serveur
startServer();

const { createServer } = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const httpServer = createServer();

// Configuration du port via les arguments de ligne de commande
const PORT = process.argv[2] ? parseInt(process.argv[2]) : 3000;

// Configuration Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CHANNEL = 'chat_messages';

// Connexions Redis (une pour publier, une pour souscrire)
let redisPublisher = null;
let redisSubscriber = null;
const io = new Server(httpServer,{
    cors: {
        origin: "*",
        methods: ['GET', 'POST']
    }
});

// Stockage des utilisateurs connectés par room
const usersByRoom = new Map();

// Stockage des sockets par nom d'utilisateur pour les messages privés
const userSockets = new Map(); // username -> socket

// Définir les rooms disponibles
const AVAILABLE_ROOMS = ['general', 'tech'];

// Couleurs disponibles pour les pseudos
const availableColors = [
    'red', 'blue', 'darkgreen', 'orange', 'magenta',
    'black', 'pink', 'skyblue', 'brown', 'limegreen',
    'purple', 'darkblue', 'darkred', 'darkorange', 'teal'
];

// Fonction pour attribuer une couleur aléatoire
function getRandomColor() {
    return availableColors[Math.floor(Math.random() * availableColors.length)];
}

// Système d'identifiant de messages pour éviter les boucles infinies
let messageCounter = 0;
const instanceId = Math.random().toString(36).substring(2, 15);

/**
 * Génère un identifiant unique pour chaque message
 * Combine l'ID de l'instance et un compteur pour éviter les collisions
 */
function generateMessageId() {
    return `${instanceId}_${++messageCounter}`;
}

// Fonction pour diffuser la liste des utilisateurs à une room spécifique
const broadcastUsersList = (roomName) => {
    const userList = usersByRoom.get(roomName) || [];
    console.log(`Liste des utilisateurs pour ${roomName}:`, userList);

    // Envoyer la liste des utilisateurs avec leurs couleurs
    const usersWithColors = userList.map(user => ({
        username: user.username,
        color: user.color
    }));

    io.to(roomName).emit('users', usersWithColors);
    console.log(`Liste des utilisateurs diffusée dans ${roomName}`);
};

/**
 * Initialise les connexions Redis (publisher et subscriber)
 */
async function initializeRedis() {
    try {
        // Créer les connexions Redis
        redisPublisher = new Redis(REDIS_URL);
        redisSubscriber = new Redis(REDIS_URL);

        // Configurer les gestionnaires d'erreurs
        redisPublisher.on('error', (err) => {
            console.error('❌ Erreur Redis Publisher:', err);
        });

        redisSubscriber.on('error', (err) => {
            console.error('❌ Erreur Redis Subscriber:', err);
        });

        // S'abonner au canal de messages
        await redisSubscriber.subscribe(REDIS_CHANNEL);
        console.log(`📡 Instance ${instanceId} abonnée au canal Redis: ${REDIS_CHANNEL}`);

        // Gérer les messages reçus de Redis
        redisSubscriber.on('message', (channel, messageData) => {
            if (channel === REDIS_CHANNEL) {
                try {
                    const parsedMessage = JSON.parse(messageData);
                    console.log(`📨 Message reçu de Redis par instance ${instanceId}:`, parsedMessage);

                    // Diffuser le message aux clients locaux (uniquement si ce n'est pas notre propre message)
                    broadcastMessageFromRedis(parsedMessage);
                } catch (error) {
                    console.error('❌ Erreur lors du parsing du message Redis:', error);
                }
            }
        });

        console.log(`✅ Redis initialisé avec succès pour l'instance ${instanceId}`);
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Redis:', error);
        console.log('💡 L\'application continuera sans Redis. Les messages resteront locaux à cette instance.');
    }
}

/**
 * Publie un message sur Redis pour diffusion à toutes les instances
 */
async function publishMessageToRedis(messageData) {
    if (!redisPublisher) {
        console.log('⚠️ Redis non disponible, message non publié');
        return;
    }

    try {
        const messageWithId = {
            ...messageData,
            messageId: generateMessageId(),
            instanceId: instanceId
        };

        const serializedMessage = JSON.stringify(messageWithId);
        await redisPublisher.publish(REDIS_CHANNEL, serializedMessage);
        console.log(`📤 Message publié sur Redis par instance ${instanceId}:`, messageWithId);
    } catch (error) {
        console.error('❌ Erreur lors de la publication du message sur Redis:', error);
    }
}

/**
 * Diffuse un message reçu de Redis aux clients locaux
 */
function broadcastMessageFromRedis(messageData) {
    const { messageId, instanceId: sourceInstanceId, room, type, ...message } = messageData;

    // Éviter de traiter nos propres messages
    if (sourceInstanceId === instanceId) {
        console.log(`🔄 Message ${messageId} ignoré (provenant de cette instance)`);
        return;
    }

    console.log(`📢 Diffusion du message ${messageId} de l'instance ${sourceInstanceId} aux clients locaux`);

    // Diffuser selon le type de message
    switch (type) {
        case 'public_message':
            // Diffuser aux autres membres de la room
            io.to(room).emit('message', message);
            break;

        case 'user_joined':
            // Diffuser l'arrivée d'un utilisateur
            io.to(room).emit('user_joined', message);
            break;

        case 'user_left':
            // Diffuser le départ d'un utilisateur
            io.to(room).emit('user_left', message);
            break;

        case 'private_message':
            // Diffuser le message privé au destinataire
            const targetSocket = userSockets.get(message.target);
            if (targetSocket) {
                targetSocket.emit('private_message', message);
            }
            break;

        default:
            console.log(`⚠️ Type de message inconnu: ${type}`);
    }
}

io.on('connection', (socket) => {
    console.log('Un client est connecté, id:', socket.id);

    // Gestion de la connexion d'un utilisateur avec pseudonyme et room
    socket.on('user_connected', async (data) => {
        const { username, room } = data;

        // Vérifier que la room existe
        if (!AVAILABLE_ROOMS.includes(room)) {
            socket.emit('error', { message: 'Room invalide' });
            return;
        }

        // Vérifier si le pseudonyme est déjà utilisé globalement
        if (userSockets.has(username)) {
            console.log(`❌ Tentative de connexion avec un pseudonyme déjà utilisé: ${username}`);
            socket.emit('error', { 
                message: `Le pseudonyme "${username}" est déjà utilisé. Veuillez choisir un autre nom.`,
                type: 'username_taken'
            });
            return;
        }

        // Attribuer une couleur aléatoire à l'utilisateur
        const color = getRandomColor();

        // Stocker les informations de l'utilisateur
        socket.username = username;
        socket.room = room;
        socket.color = color;

        // Rejoindre la room (Socket.IO gère automatiquement l'isolation)
        socket.join(room);

        // Initialiser la room si elle n'existe pas
        if (!usersByRoom.has(room)) {
            usersByRoom.set(room, []);
        }

        // Ajouter l'utilisateur à la room avec sa couleur
        const roomUsers = usersByRoom.get(room);
        const userExists = roomUsers.find(user => user.username === username);
        if (!userExists) {
            roomUsers.push({ username, color });
            usersByRoom.set(room, roomUsers);
        }

        // Stocker le socket pour les messages privés (maintenant sécurisé)
        userSockets.set(username, socket);
        console.log(`🔒 Utilisateur ${username} enregistré pour les messages privés`);
        console.log(`🔒 Utilisateurs connectés:`, Array.from(userSockets.keys()));

        console.log(`Utilisateur ${username} rejoint la room ${room} avec la couleur ${color}`);

        // Publier l'arrivée de l'utilisateur sur Redis
        const joinData = {
            type: 'user_joined',
            room: room,
            username: username,
            color: color
        };
        await publishMessageToRedis(joinData);

        // Diffusion locale (pour maintenir la compatibilité)
        socket.to(room).emit('user_joined', { username, color });

        // Diffuser la liste des utilisateurs de la room
        broadcastUsersList(room);

        // Envoyer la liste des rooms disponibles
        socket.emit('available_rooms', AVAILABLE_ROOMS);
    });

    // Gestion des messages (selon les bonnes pratiques Socket.IO)
    socket.on('message', async (msg) => {
        console.log(`Message de ${socket.username} dans ${socket.room}:`, msg);

        // Vérifier que le socket a une room assignée
        if (!socket.room) {
            console.error('Socket sans room assignée');
            return;
        }

        // Vérifier si c'est une commande /room
        if (msg.message && msg.message.startsWith('/room ')) {
            const newRoom = msg.message.substring(6).trim();
            
            // Vérifier que la room existe
            if (!AVAILABLE_ROOMS.includes(newRoom)) {
                socket.emit('error', { message: `Room "${newRoom}" n'existe pas. Rooms disponibles: ${AVAILABLE_ROOMS.join(', ')}` });
                return;
            }
            
            // Vérifier que ce n'est pas la même room
            if (newRoom === socket.room) {
                socket.emit('error', { message: `Vous êtes déjà dans la room "${newRoom}"` });
                return;
            }
            
            const oldRoom = socket.room;
            
            // Publier le départ de l'ancienne room sur Redis
            const leaveData = {
                type: 'user_left',
                room: oldRoom,
                username: socket.username,
                color: socket.color
            };
            await publishMessageToRedis(leaveData);

            // Diffusion locale du départ
            socket.to(oldRoom).emit('user_left', {
                username: socket.username,
                color: socket.color
            });

            // Retirer l'utilisateur de l'ancienne room
            const oldRoomUsers = usersByRoom.get(oldRoom) || [];
            const updatedOldRoomUsers = oldRoomUsers.filter(user => user.username !== socket.username);
            usersByRoom.set(oldRoom, updatedOldRoomUsers);

            // Quitter l'ancienne room
            socket.leave(oldRoom);

            // Rejoindre la nouvelle room
            socket.join(newRoom);
            socket.room = newRoom;

            // Ajouter l'utilisateur à la nouvelle room
            const newRoomUsers = usersByRoom.get(newRoom) || [];
            const userExists = newRoomUsers.find(user => user.username === socket.username);
            if (!userExists) {
                newRoomUsers.push({
                    username: socket.username,
                    color: socket.color
                });
                usersByRoom.set(newRoom, newRoomUsers);
            }

            // Publier l'arrivée dans la nouvelle room sur Redis
            const joinData = {
                type: 'user_joined',
                room: newRoom,
                username: socket.username,
                color: socket.color
            };
            await publishMessageToRedis(joinData);

            // Diffusion locale de l'arrivée
            socket.to(newRoom).emit('user_joined', {
                username: socket.username,
                color: socket.color
            });
            
            // Diffuser les listes mises à jour
            broadcastUsersList(oldRoom);
            broadcastUsersList(newRoom);
            
            // Confirmer le changement de room au client
            socket.emit('room_changed', {
                oldRoom: oldRoom,
                newRoom: newRoom,
                message: `Vous avez rejoint la room "${newRoom}"`
            });
            
            console.log(`${socket.username} a changé de room: ${oldRoom} -> ${newRoom}`);
            return;
        }

        // Message normal
        // Publier le message sur Redis pour diffusion à toutes les instances
        const messageData = {
            type: 'public_message',
            room: socket.room,
            username: socket.username,
            message: msg.message,
            color: socket.color
        };

        await publishMessageToRedis(messageData);

        // Diffusion locale (pour maintenir la compatibilité si Redis n'est pas disponible)
        const messageWithColor = {
            username: socket.username,
            message: msg.message,
            color: socket.color
        };
        socket.to(socket.room).emit('message', messageWithColor);

        console.log(`Message envoyé aux autres membres de ${socket.room}`);
    });

    // Gestion des messages privés
    socket.on('private_message', async (data) => {
        console.log(`🔒 MESSAGE PRIVÉ REÇU DU SERVEUR:`);
        console.log(`🔒 Expéditeur: ${socket.username}`);
        console.log(`🔒 Destinataire: ${data.target}`);
        console.log(`🔒 Message: ${data.message}`);
        console.log(`🔒 Tous les utilisateurs connectés:`, Array.from(userSockets.keys()));

        // Vérifier que le socket a une room assignée
        if (!socket.room) {
            console.error('🔒 Socket sans room assignée');
            return;
        }

        // Publier le message privé sur Redis pour diffusion à toutes les instances
        const privateMessageData = {
            type: 'private_message',
            username: data.username,
            message: data.message,
            target: data.target,
            color: socket.color
        };

        await publishMessageToRedis(privateMessageData);

        // Gestion locale (pour maintenir la compatibilité si Redis n'est pas disponible)
        const targetSocket = userSockets.get(data.target);
        console.log(`🔒 Socket du destinataire trouvé:`, targetSocket ? 'OUI' : 'NON');

        if (targetSocket) {
            // Envoyer le message privé au destinataire local
            const localPrivateMessageData = {
                username: data.username,
                message: data.message,
                color: socket.color
            };

            console.log(`🔒 Envoi du message privé:`, localPrivateMessageData);
            targetSocket.emit('private_message', localPrivateMessageData);
            console.log(`🔒 Message privé envoyé de ${data.username} à ${data.target}`);
        } else {
            console.log(`🔒 Utilisateur ${data.target} non trouvé ou déconnecté`);
            console.log(`🔒 Utilisateurs disponibles:`, Array.from(userSockets.keys()));
            // Optionnel : envoyer un message d'erreur à l'expéditeur
            socket.emit('error', { message: `Utilisateur ${data.target} non trouvé` });
        }
    });
    
    // Gestion de la déconnexion
    socket.on('disconnect', async () => {
        if (socket.username && socket.room) {
            console.log(`Utilisateur déconnecté: ${socket.username} de la room ${socket.room} (socket: ${socket.id})`);

            // Publier le départ sur Redis
            const leaveData = {
                type: 'user_left',
                room: socket.room,
                username: socket.username,
                color: socket.color
            };
            await publishMessageToRedis(leaveData);

            // Supprimer l'utilisateur de la room
            const roomUsers = usersByRoom.get(socket.room);
            if (roomUsers) {
                const index = roomUsers.findIndex(user => user.username === socket.username);
                if (index > -1) {
                    roomUsers.splice(index, 1);
                    usersByRoom.set(socket.room, roomUsers);
                }
            }

            // Diffusion locale du départ
            socket.to(socket.room).emit('user_left', { username: socket.username, color: socket.color });

            // Supprimer le socket des messages privés
            userSockets.delete(socket.username);
            console.log(`🔒 Utilisateur ${socket.username} supprimé des messages privés`);
            console.log(`🔒 Utilisateurs restants:`, Array.from(userSockets.keys()));

            // Diffuser la nouvelle liste des utilisateurs de la room
            broadcastUsersList(socket.room);
        } else {
            console.log('Un client s\'est déconnecté, id:', socket.id);
        }
    });
});

// Initialisation de Redis et démarrage du serveur
async function startServer() {
    try {
        // Initialiser Redis
        await initializeRedis();

        // Démarrer le serveur HTTP
        httpServer.listen(PORT, () => {
            console.log(`🚀 Serveur démarré sur le port ${PORT}`);
            console.log(`📡 Instance ID: ${instanceId}`);
            console.log(`🔗 Redis URL: ${REDIS_URL}`);
            console.log(`📺 Canal Redis: ${REDIS_CHANNEL}`);
            console.log('✅ Prêt à recevoir des connexions !');
        });
    } catch (error) {
        console.error('❌ Erreur lors du démarrage du serveur:', error);
        process.exit(1);
    }
}

// Démarrer le serveur
startServer();

// Gestion des erreurs du serveur
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

// Gestion de l'arrêt propre du serveur
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');

    // Fermer les connexions Redis
    if (redisPublisher) {
        await redisPublisher.quit();
        console.log('✅ Connexion Redis Publisher fermée');
    }
    if (redisSubscriber) {
        await redisSubscriber.quit();
        console.log('✅ Connexion Redis Subscriber fermée');
    }

    // Fermer le serveur HTTP
    httpServer.close(() => {
        console.log('✅ Serveur HTTP arrêté proprement');
        process.exit(0);
    });
});
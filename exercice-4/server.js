const { createServer } = require('http');
const { Server } = require('socket.io');
const httpServer = createServer();
const PORT = 3000;
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

io.on('connection', (socket) => {
    console.log('Un client est connecté, id:', socket.id);

    // Gestion de la connexion d'un utilisateur avec pseudonyme et room
    socket.on('user_connected', (data) => {
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

        // Diffuser aux autres membres de la room
        socket.to(room).emit('user_joined', { username, color });

        // Diffuser la liste des utilisateurs de la room
        broadcastUsersList(room);

        // Envoyer la liste des rooms disponibles
        socket.emit('available_rooms', AVAILABLE_ROOMS);
    });

    // Gestion des messages (selon les bonnes pratiques Socket.IO)
    socket.on('message', (msg) => {
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
            
            // Notifier le départ de l'ancienne room
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
            
            // Notifier l'arrivée dans la nouvelle room
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
        // Ajouter la couleur à l'utilisateur dans le message
        const messageWithColor = {
            ...msg,
            color: socket.color
        };

        // Envoyer uniquement aux autres membres de la room
        // socket.to() = aux autres membres de la room uniquement
        socket.to(socket.room).emit('message', messageWithColor);

        console.log(`Message envoyé aux autres membres de ${socket.room}`);
    });

    // Gestion des messages privés
    socket.on('private_message', (data) => {
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

        // Trouver le socket du destinataire
        const targetSocket = userSockets.get(data.target);
        console.log(`🔒 Socket du destinataire trouvé:`, targetSocket ? 'OUI' : 'NON');
        
        if (targetSocket) {
            // Envoyer le message privé au destinataire
            const privateMessageData = {
                username: data.username,
                message: data.message,
                color: socket.color
            };
            
            console.log(`🔒 Envoi du message privé:`, privateMessageData);
            targetSocket.emit('private_message', privateMessageData);
            console.log(`🔒 Message privé envoyé de ${data.username} à ${data.target}`);
        } else {
            console.log(`🔒 Utilisateur ${data.target} non trouvé ou déconnecté`);
            console.log(`🔒 Utilisateurs disponibles:`, Array.from(userSockets.keys()));
            // Optionnel : envoyer un message d'erreur à l'expéditeur
            socket.emit('error', { message: `Utilisateur ${data.target} non trouvé` });
        }
    });
    
    // Gestion de la déconnexion
    socket.on('disconnect', () => {
        if (socket.username && socket.room) {
            console.log(`Utilisateur déconnecté: ${socket.username} de la room ${socket.room} (socket: ${socket.id})`);
            
            // Supprimer l'utilisateur de la room
            const roomUsers = usersByRoom.get(socket.room);
            if (roomUsers) {
                const index = roomUsers.findIndex(user => user.username === socket.username);
                if (index > -1) {
                    roomUsers.splice(index, 1);
                    usersByRoom.set(socket.room, roomUsers);
                }
            }
            
            // Diffuser un message de départ aux autres membres de la room
            // (Socket.IO gère l'isolation par room - pas besoin d'inclure la room)
            socket.to(socket.room).emit('user_left', { username: socket.username });
            
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

httpServer.listen(PORT, () => {
    console.log('Le serveur est en écoute sur le port 3000');
});

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
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    httpServer.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});
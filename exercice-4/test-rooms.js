// Test rapide des rooms
const { createServer } = require('http');
const { Server } = require('socket.io');
const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST']
    }
});

const AVAILABLE_ROOMS = ['general', 'tech'];
const usersByRoom = new Map();

// Fonction simplifiée pour les tests
const broadcastUsersList = (roomName) => {
    const userList = usersByRoom.get(roomName) || [];
    io.to(roomName).emit('users', userList);
    console.log(`Liste des utilisateurs diffusée dans ${roomName}:`, userList);
};

io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    socket.on('user_connected', (data) => {
        const { username, room } = data;

        socket.username = username;
        socket.room = room;

        socket.join(room);

        if (!usersByRoom.has(room)) {
            usersByRoom.set(room, []);
        }

        const roomUsers = usersByRoom.get(room);
        if (!roomUsers.includes(username)) {
            roomUsers.push(username);
            usersByRoom.set(room, roomUsers);
        }

        console.log(`${username} rejoint ${room}`);

        socket.to(room).emit('user_joined', { username });

        broadcastUsersList(room);

        socket.emit('available_rooms', AVAILABLE_ROOMS);
    });

    socket.on('message', (msg) => {
        console.log(`Message de ${socket.username} dans ${socket.room}:`, msg);
        socket.to(socket.room).emit('message', msg);
    });

    socket.on('disconnect', () => {
        if (socket.username && socket.room) {
            console.log(`${socket.username} quitte ${socket.room}`);

            const roomUsers = usersByRoom.get(socket.room);
            if (roomUsers) {
                const index = roomUsers.indexOf(socket.username);
                if (index > -1) {
                    roomUsers.splice(index, 1);
                    usersByRoom.set(socket.room, roomUsers);
                }
            }

            socket.to(socket.room).emit('user_left', { username: socket.username });
            broadcastUsersList(socket.room);
        }
    });
});

httpServer.listen(3000, () => {
    console.log('Serveur de test démarré sur le port 3000');
});

process.on('SIGINT', () => {
    console.log('\nArrêt du serveur de test');
    httpServer.close();
    process.exit(0);
});

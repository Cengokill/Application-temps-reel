const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Création du serveur HTTP pour servir les fichiers statiques
const server = http.createServer((req, res) => {
    // Vérifier si c'est une requête d'upgrade WebSocket
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        // Laisser le serveur WebSocket gérer cette requête
        return;
    }

    // Servir client.html par défaut ou d'autres fichiers statiques
    let filePath = path.join(__dirname, req.url === '/' ? 'client.html' : req.url);

    // Vérifier si le fichier existe
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404);
            res.end('Fichier non trouvé');
            return;
        }

        // Déterminer le type de contenu
        const ext = path.extname(filePath);
        let contentType = 'text/html';

        switch (ext) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.jpg':
                contentType = 'image/jpg';
                break;
        }

        // Lire et servir le fichier
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Erreur serveur');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

// Création du serveur WebSocket avec noServer pour contrôler manuellement les upgrades
const wss = new WebSocket.Server({ noServer: true });

// Gestionnaire des upgrades WebSocket
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Démarrage du serveur sur le port 8080
server.listen(8080, () => {
    console.log('Serveur HTTP et WebSocket démarré sur le port 8080');
    console.log('Accédez à http://localhost:8080 pour ouvrir le client de chat');
});

// Stockage des clients connectés avec leurs informations
const clients = new Map(); // ws -> { id, username, color }
const usedUsernames = new Set();

// Couleurs disponibles pour les pseudos
const availableColors = [
    'red', 'blue', 'darkgreen', 'orange', 'magenta',
    'black', 'pink', 'skyblue', 'brown', 'limegreen'
];

// Fonction pour générer un pseudonyme unique
function generateUniqueUsername() {
    let username;
    let attempts = 0;

    do {
        const randomNum = Math.floor(Math.random() * 1000);
        username = `utilisateur_${randomNum.toString().padStart(3, '0')}`;
        attempts++;

        // Éviter les boucles infinies (limite à 1000 tentatives)
        if (attempts > 1000) {
            username = `utilisateur_${Date.now()}`;
            break;
        }
    } while (usedUsernames.has(username));

    usedUsernames.add(username);
    return username;
}

// Fonction pour attribuer une couleur aléatoire
function getRandomColor() {
    return availableColors[Math.floor(Math.random() * availableColors.length)];
}

wss.on('connection', (ws) => {
    console.log('Nouveau client connecté');

    // Générer un pseudonyme unique et une couleur pour ce client
    const username = generateUniqueUsername();
    const color = getRandomColor();

    // Stocker les informations du client
    clients.set(ws, {
        username: username,
        color: color,
        connectedAt: new Date()
    });

    console.log(`Utilisateur ${username} connecté avec la couleur ${color}`);

    // Fonction pour formater la date au format dd/mm/aaaa HH:mm:ss
    function formatTimestamp() {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    // Gérer la réception de messages
    ws.on('message', (message) => {
        console.log(`Message reçu de ${clients.get(ws).username}: ${message}`);

        // Récupérer les informations du client expéditeur
        const clientInfo = clients.get(ws);
        if (!clientInfo) return;

        // Créer le message avec horodatage et pseudo coloré
        const timestamp = formatTimestamp();
        const messageWithMetadata = `[${timestamp}] <span style="color: ${clientInfo.color}">${clientInfo.username}</span>: ${message}`;

        // Retransmettre le message avec horodatage et pseudo à tous les clients connectés (y compris l'expéditeur)
        // Cela permet à chaque utilisateur de voir ses propres messages dans la conversation
        clients.forEach((clientData, clientWs) => {
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(messageWithMetadata);
            }
        });
    });

    // Gérer la déconnexion d'un client
    ws.on('close', () => {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            console.log(`Utilisateur ${clientInfo.username} déconnecté`);
            // Libérer le pseudonyme pour qu'il puisse être réutilisé
            usedUsernames.delete(clientInfo.username);
        }
        clients.delete(ws);
    });

    // Gérer les erreurs
    ws.on('error', (error) => {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            console.error(`Erreur WebSocket pour ${clientInfo.username}:`, error);
            usedUsernames.delete(clientInfo.username);
        } else {
            console.error('Erreur WebSocket:', error);
        }
        clients.delete(ws);
    });
});

console.log('Serveur prêt à accepter les connexions...');

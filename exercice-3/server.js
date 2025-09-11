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

// Stockage des clients connectés
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('Nouveau client connecté');

    // Ajouter le client à la liste des clients connectés
    clients.add(ws);

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
        console.log(`Message reçu: ${message}`);

        // Créer le message avec horodatage
        const timestamp = formatTimestamp();
        const messageWithTimestamp = `[${timestamp}] ${message}`;

        // Retransmettre le message avec horodatage à tous les clients connectés (y compris l'expéditeur)
        // Cela permet à chaque utilisateur de voir ses propres messages dans la conversation
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageWithTimestamp);
            }
        });
    });

    // Gérer la déconnexion d'un client
    ws.on('close', () => {
        console.log('Client déconnecté');
        clients.delete(ws);
    });

    // Gérer les erreurs
    ws.on('error', (error) => {
        console.error('Erreur WebSocket:', error);
        clients.delete(ws);
    });
});

console.log('Serveur prêt à accepter les connexions...');

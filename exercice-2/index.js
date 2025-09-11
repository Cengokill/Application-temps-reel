const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Servir les fichiers statiques (HTML, CSS, JS)

// État de la tâche
let currentTaskStatus = "En attente";
let statusVersion = 0;

// Liste des connexions en attente pour le Long Polling
let pendingConnections = [];

// Fonction pour notifier toutes les connexions en attente
function notifyPendingConnections() {
    pendingConnections.forEach(connection => {
        clearTimeout(connection.timeoutId);
        connection.res.json({
            status: currentTaskStatus,
            version: statusVersion,
            changed: true
        });
    });
    pendingConnections = [];
}

// Endpoint pour mettre à jour le statut (Admin)
app.post('/update-status', (req, res) => {
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Le paramètre status est requis' });
    }

    // Liste des statuts valides
    const validStatuses = ["En attente", "En cours", "Terminée", "Échec"];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: `Statut invalide. Statuts valides: ${validStatuses.join(', ')}`
        });
    }

    // Mettre à jour l'état
    currentTaskStatus = status;
    statusVersion++;

    console.log(`Statut mis à jour: ${currentTaskStatus} (version: ${statusVersion})`);

    // Notifier toutes les connexions en attente
    notifyPendingConnections();

    res.json({
        message: 'Statut mis à jour avec succès',
        status: currentTaskStatus,
        version: statusVersion
    });
});

// Endpoint pour obtenir le statut actuel (sans Long Polling)
app.get('/get-status', (req, res) => {
    res.json({
        status: currentTaskStatus,
        version: statusVersion
    });
});

// Endpoint Long Polling
// Quand le client fait une requête à cet endpoint, le serveur va attendre 25 secondes pour voir 
// si le statut a changé.
// Si le statut a changé, le serveur va renvoyer le nouveau statut au client.
// Si le statut n'a pas changé, le serveur va renvoyer un 204.
// Le client va reconnexer automatiquement après 2 secondes.
app.get('/poll-status', (req, res) => {
    const lastVersion = parseInt(req.query.last_version) || 0;
    const maxWaitTime = 25000; // 25 secondes

    // Si le statut a changé depuis la dernière version du client
    if (lastVersion < statusVersion) {
        return res.json({
            status: currentTaskStatus,
            version: statusVersion,
            changed: true
        });
    }

    // Créer un objet pour suivre cette connexion
    const connection = {
        res: res,
        timeoutId: null
    };

    // Configurer un timeout pour fermer la connexion après maxWaitTime
    connection.timeoutId = setTimeout(() => {
        // Retirer cette connexion de la liste des connexions en attente
        pendingConnections = pendingConnections.filter(conn => conn !== connection);

        // Envoyer une réponse indiquant qu'il n'y a pas eu de changement
        res.status(204).end(); // 204 No Content
    }, maxWaitTime);

    // Ajouter cette connexion à la liste des connexions en attente
    pendingConnections.push(connection);

    console.log(`Nouvelle connexion en attente. Total: ${pendingConnections.length}`);
});

// Route par défaut pour servir l'interface
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
    console.log(`Statut initial: ${currentTaskStatus} (version: ${statusVersion})`);
});

// Gestion propre de l'arrêt du serveur
process.on('SIGINT', () => {
    console.log('Arrêt du serveur...');
    // Fermer toutes les connexions en attente
    pendingConnections.forEach(connection => {
        clearTimeout(connection.timeoutId);
        connection.res.status(500).json({ error: 'Serveur arrêté' });
    });
    process.exit(0);
});

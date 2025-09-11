// Configuration
const API_BASE = window.location.origin;

// Éléments DOM
const statusText = document.getElementById('statusText');
const statusVersion = document.getElementById('statusVersion');
const statusDisplay = document.getElementById('statusDisplay');
const connectionStatus = document.getElementById('connectionStatus');
const statusSelect = document.getElementById('statusSelect');
const updateButton = document.getElementById('updateButton');
const adminMessage = document.getElementById('adminMessage');
const logsContainer = document.getElementById('logs');
const tickerContent = document.getElementById('tickerContent');

// État local
let currentVersion = 0;
let isPolling = false;
let pollingController = null;
let tickerInterval = null;
let connectionState = 'waiting';
let totalLogs = 1; // Commence avec le log d'initialisation

// Fonction pour ajouter un log
function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';

    const timestamp = new Date().toLocaleTimeString();
    logEntry.setAttribute('data-timestamp', timestamp);
    logEntry.classList.add('timestamp');

    let prefix = '';
    switch(type) {
        case 'success': prefix = '✓ '; break;
        case 'error': prefix = '✗ '; break;
        case 'update': prefix = '🔄 '; break;
        default: prefix = 'ℹ '; break;
    }

    logEntry.textContent = prefix + message;

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    totalLogs++;
    updateTickerElement('ticker-logs', `📝 ${totalLogs} logs enregistrés`);
}

// Fonction pour mettre à jour l'affichage du statut
function updateStatusDisplay(status, version) {
    statusText.textContent = status;
    statusVersion.textContent = `Version: ${version}`;

    // Supprimer toutes les classes de statut
    statusDisplay.className = 'status-display';

    // Ajouter la classe appropriée selon le statut
    const statusClass = 'status-' + status.toLowerCase().replace(' ', '-');
    statusText.classList.add(statusClass);

    addLog(`Statut mis à jour: ${status} (v${version})`, 'update');

    // Mise à jour immédiate des éléments concernés
    updateTickerElement('ticker-status', `📊 Statut: ${status}`);
    updateTickerElement('ticker-version', `🔢 Version: ${version}`);
}

// Fonction pour initialiser le bandeau dynamique
function initializeTicker() {
    createTickerElements();
    updateTickerContent();

    // Mise à jour de l'heure toutes les secondes (temps réel)
    window.timeUpdateInterval = setInterval(updateTimeDisplay, 1000);

    // Mise à jour complète des autres éléments toutes les 30 secondes
    tickerInterval = setInterval(updateTickerContent, 40000);
}

// Fonction pour mettre à jour seulement l'heure (appelée chaque seconde)
function updateTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    updateTickerElement('ticker-time', `🕐 ${timeString}`);
}

// Fonction pour créer les éléments du bandeau avec IDs individuels
function createTickerElements() {
    const items = [
        { id: 'ticker-date', icon: '📅', text: 'Date' },
        { id: 'ticker-time', icon: '🕐', text: 'Heure' },
        { id: 'ticker-status', icon: '📊', text: 'Statut' },
        { id: 'ticker-version', icon: '🔢', text: 'Version' },
        { id: 'ticker-connection', icon: '📡', text: 'Connexion' },
        { id: 'ticker-logs', icon: '📝', text: 'Logs' },
        { id: 'ticker-system', icon: '⚡', text: 'Système' }
    ];

    tickerContent.innerHTML = items.map(item =>
        `<span class="ticker-item" id="${item.id}">${item.icon} ${item.text}</span>`
    ).join('');
}

// Fonction pour mettre à jour un élément spécifique du bandeau
function updateTickerElement(elementId, content) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = content;
    }
}

// Fonction pour mettre à jour tous les éléments du bandeau (sauf l'heure)
function updateTickerContent() {
    const now = new Date();
    const dateString = now.toLocaleDateString('fr-FR');

    let connectionText = '';
    switch(connectionState) {
        case 'connected': connectionText = '🟢 Connecté'; break;
        case 'waiting': connectionText = '🟡 En attente'; break;
        case 'error': connectionText = '🔴 Erreur connexion'; break;
        default: connectionText = '⚪ Initialisation'; break;
    }

    const statusText = document.getElementById('statusText').textContent;
    const versionText = document.getElementById('statusVersion').textContent;

    // Mise à jour de chaque élément individuellement (l'heure est gérée séparément)
    updateTickerElement('ticker-date', `📅 ${dateString}`);
    updateTickerElement('ticker-status', `📊 Statut: ${statusText}`);
    updateTickerElement('ticker-version', `🔢 ${versionText}`);
    updateTickerElement('ticker-connection', `📡 ${connectionText}`);
    updateTickerElement('ticker-logs', `📝 ${totalLogs} logs enregistrés`);
    updateTickerElement('ticker-system', `⚡ Système en temps réel actif`);
}

// Fonction pour mettre à jour le statut de connexion
function updateConnectionStatus(status, message) {
    connectionStatus.textContent = message;
    connectionStatus.className = 'connection-status connection-' + status;
    connectionState = status;

    // Mise à jour immédiate seulement de l'état de connexion
    let connectionText = '';
    switch(status) {
        case 'connected': connectionText = '🟢 Connecté'; break;
        case 'waiting': connectionText = '🟡 En attente'; break;
        case 'error': connectionText = '🔴 Erreur connexion'; break;
        default: connectionText = '⚪ Initialisation'; break;
    }
    updateTickerElement('ticker-connection', `📡 ${connectionText}`);
}

// Fonction pour effectuer une requête Long Polling
async function pollStatus() {
    if (isPolling) return;

    isPolling = true;
    updateConnectionStatus('waiting', 'En attente de mise à jour...');

    try {
        // Créer un AbortController pour pouvoir annuler la requête
        pollingController = new AbortController();

        const response = await fetch(`${API_BASE}/poll-status?last_version=${currentVersion}`, {
            signal: pollingController.signal
        });

        if (response.status === 204) {
            // Pas de changement, continuer le polling
            updateConnectionStatus('waiting', 'Aucune mise à jour, reconnexion...');
            addLog('Aucune mise à jour reçue, reconnexion automatique', 'info');
        } else if (response.ok) {
            const data = await response.json();
            if (data.changed) {
                updateStatusDisplay(data.status, data.version);
                currentVersion = data.version;
                updateConnectionStatus('connected', 'Connecté - Mise à jour reçue');
            }
        } else {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            addLog('Requête annulée', 'info');
        } else {
            updateConnectionStatus('error', 'Erreur de connexion');
            addLog(`Erreur de connexion: ${error.message}`, 'error');
        }
    } finally {
        isPolling = false;
        pollingController = null;

        // Relancer automatiquement le polling après un court délai
        setTimeout(pollStatus, 1000);
    }
}

// Fonction pour obtenir le statut initial
async function getInitialStatus() {
    try {
        updateConnectionStatus('waiting', 'Connexion au serveur...');

        const response = await fetch(`${API_BASE}/get-status`);
        if (response.ok) {
            const data = await response.json();
            updateStatusDisplay(data.status, data.version);
            currentVersion = data.version;
            updateConnectionStatus('connected', 'Connecté');
            addLog('Connexion établie avec le serveur', 'success');

            // Démarrer le Long Polling
            pollStatus();
        } else {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
    } catch (error) {
        updateConnectionStatus('error', 'Erreur de connexion');
        addLog(`Impossible de se connecter: ${error.message}`, 'error');

        // Réessayer après 5 secondes
        setTimeout(getInitialStatus, 5000);
    }
}

// Fonction pour mettre à jour le statut via l'admin
async function updateStatus(newStatus) {
    updateButton.disabled = true;
    adminMessage.textContent = 'Mise à jour en cours...';
    adminMessage.className = 'admin-message';

    try {
        const response = await fetch(`${API_BASE}/update-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            const data = await response.json();
            adminMessage.textContent = data.message;
            adminMessage.classList.add('success');
            addLog(`Statut modifié manuellement: ${newStatus}`, 'success');

            // Mettre à jour l'affichage local immédiatement
            updateStatusDisplay(data.status, data.version);
            currentVersion = data.version;
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Erreur inconnue');
        }
    } catch (error) {
        adminMessage.textContent = `Erreur: ${error.message}`;
        adminMessage.classList.add('error');
        addLog(`Erreur lors de la mise à jour: ${error.message}`, 'error');
    } finally {
        updateButton.disabled = false;
    }
}

// Gestionnaire d'événement pour le bouton de mise à jour
updateButton.addEventListener('click', () => {
    const selectedStatus = statusSelect.value;
    updateStatus(selectedStatus);
});

// Gestionnaire d'événement pour la touche Entrée dans le select
statusSelect.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const selectedStatus = statusSelect.value;
        updateStatus(selectedStatus);
    }
});

// Démarrer l'application
document.addEventListener('DOMContentLoaded', () => {
    addLog('Application démarrée', 'info');
    initializeTicker();
    getInitialStatus();
});

// Gestion de la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (pollingController) {
        pollingController.abort();
    }
    if (tickerInterval) {
        clearInterval(tickerInterval);
    }
    // Nettoyer également le timer de l'heure
    const timeIntervalId = window.timeUpdateInterval;
    if (timeIntervalId) {
        clearInterval(timeIntervalId);
    }
});

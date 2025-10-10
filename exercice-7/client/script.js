/**
 * Éditeur Collaboratif Temps Réel - Client
 * Gestion de la connexion Socket.IO et synchronisation de l'éditeur
 */

// Configuration
const SERVER_URL = 'http://localhost:3000';
const MAX_EDITOR_LENGTH = 50000;
const CURSOR_UPDATE_DELAY = 150;

// Configuration DOMPurify pour sécurité renforcée
const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: [], // Aucun tag HTML autorisé
    ALLOWED_ATTR: [], // Aucun attribut autorisé
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false
};

// Variables globales
let socket = null;
let username = '';
let currentRoom = '';
let userColor = '';
let editorContent = '';
let remoteCursors = new Map();
let cursorUpdateTimeout = null;
let isApplyingRemoteUpdate = false;

// Rate limiting côté client
let clientEventCounters = {
    editorUpdates: [],
    cursorUpdates: [],
    lastCleanup: Date.now()
};

// Limites côté client (plus strictes que le serveur)
const CLIENT_RATE_LIMITS = {
    EDITOR_UPDATES_PER_SECOND: 3,
    CURSOR_UPDATES_PER_SECOND: 15,
    CLEANUP_INTERVAL: 1000 // Nettoyage toutes les secondes
};

// Éléments DOM
const loginSection = document.getElementById('loginSection');
const editorSection = document.getElementById('editorSection');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const tokenInput = document.getElementById('tokenInput');
const roomSelect = document.getElementById('roomSelect');
const connectButton = document.getElementById('connectButton');
const errorMessage = document.getElementById('errorMessage');
const currentRoomDisplay = document.getElementById('currentRoom');
const currentUsernameDisplay = document.getElementById('currentUsername');
const disconnectButton = document.getElementById('disconnectButton');
const usersList = document.getElementById('usersList');
const activeUsersCount = document.getElementById('activeUsersCount');
const charCount = document.getElementById('charCount');
const collaborativeEditor = document.getElementById('collaborativeEditor');
const cursorsOverlay = document.getElementById('cursorsOverlay');
const editorCharCount = document.getElementById('editorCharCount');
const editorActiveUsers = document.getElementById('editorActiveUsers');
const notifications = document.getElementById('notifications');
const toggleThemeButton = document.getElementById('toggleThemeButton');

/**
 * Initialise l'application
 */
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadSavedTheme();
});

/**
 * Configure les écouteurs d'événements
 */
function setupEventListeners() {
    // Formulaire de connexion
    loginForm.addEventListener('submit', handleLogin);
    
    // Bouton de déconnexion
    disconnectButton.addEventListener('click', handleDisconnect);
    
    // Validation en temps réel du formulaire
    usernameInput.addEventListener('input', validateUsername);
    tokenInput.addEventListener('input', clearError);
    
    // Bouton de basculement de thème
    toggleThemeButton.addEventListener('click', toggleTheme);
    
    // Sélection d'espace de travail
    setupRoomSelection();
}

/**
 * Gère la connexion
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const token = tokenInput.value.trim();
    const room = roomSelect.value;
    
    // Validation
    if (!validateLoginData(username, token, room)) {
        return;
    }
    
    try {
        await connectToServer(username, token, room);
    } catch (error) {
        showError(`Erreur de connexion: ${error.message}`);
    }
}

/**
 * Sanitiser une chaîne avec DOMPurify
 */
function sanitizeString(input) {
    if (typeof input !== 'string') {
        return '';
    }
    
    // Sanitiser avec DOMPurify
    const sanitized = DOMPurify.sanitize(input, DOMPURIFY_CONFIG);
    
    // Vérifier les patterns suspects supplémentaires
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
        /document\./i,
        /window\./i,
        /alert\s*\(/i,
        /confirm\s*\(/i,
        /prompt\s*\(/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(sanitized))) {
        console.warn('⚠️ Contenu suspect détecté et supprimé:', input);
        return '';
    }
    
    return sanitized;
}

/**
 * Valide les données de connexion avec sanitisation renforcée
 */
function validateLoginData(username, token, room) {
    // Sanitiser les entrées
    const sanitizedUsername = sanitizeString(username);
    const sanitizedToken = sanitizeString(token);
    const sanitizedRoom = sanitizeString(room);
    
    if (sanitizedUsername.length < 2) {
        showError('Le pseudonyme doit contenir au moins 2 caractères');
        return false;
    }
    
    if (sanitizedUsername.length > 20) {
        showError('Le pseudonyme ne peut pas dépasser 20 caractères');
        return false;
    }
    
    // Vérifier que le pseudonyme ne contient que des caractères autorisés
    const allowedUsernamePattern = /^[a-zA-Z0-9\s\-_\.]+$/;
    if (!allowedUsernamePattern.test(sanitizedUsername)) {
        showError('Le pseudonyme ne peut contenir que des lettres, chiffres, espaces, tirets, underscores et points');
        return false;
    }
    
    if (!sanitizedToken) {
        showError('Le token est requis');
        return false;
    }
    
    if (!sanitizedRoom) {
        showError('Veuillez sélectionner une room');
        return false;
    }
    
    // Vérifier que la room est valide
    const allowedRooms = ['general', 'tech', 'projet', 'notes'];
    if (!allowedRooms.includes(sanitizedRoom)) {
        showError('Room invalide');
        return false;
    }
    
    return true;
}

/**
 * Nettoie les compteurs d'événements côté client
 */
function cleanupClientEventCounters() {
    const now = Date.now();
    const cutoff = now - 1000; // Garder seulement la dernière seconde
    
    clientEventCounters.editorUpdates = clientEventCounters.editorUpdates.filter(timestamp => timestamp > cutoff);
    clientEventCounters.cursorUpdates = clientEventCounters.cursorUpdates.filter(timestamp => timestamp > cutoff);
    clientEventCounters.lastCleanup = now;
}

/**
 * Vérifie si un événement peut être envoyé (rate limiting côté client)
 */
function canSendEvent(eventType) {
    const now = Date.now();
    
    // Nettoyer les anciens événements si nécessaire
    if (now - clientEventCounters.lastCleanup > CLIENT_RATE_LIMITS.CLEANUP_INTERVAL) {
        cleanupClientEventCounters();
    }
    
    let limit, counter;
    switch (eventType) {
        case 'editor_update':
            limit = CLIENT_RATE_LIMITS.EDITOR_UPDATES_PER_SECOND;
            counter = clientEventCounters.editorUpdates;
            break;
        case 'cursor_position':
            limit = CLIENT_RATE_LIMITS.CURSOR_UPDATES_PER_SECOND;
            counter = clientEventCounters.cursorUpdates;
            break;
        default:
            return true;
    }
    
    // Vérifier la limite
    if (counter.length >= limit) {
        console.warn(`⚠️ Rate limit côté client dépassé pour ${eventType}: ${counter.length}/${limit}`);
        return false;
    }
    
    // Ajouter l'événement
    counter.push(now);
    return true;
}

/**
 * Valide le pseudonyme en temps réel
 */
function validateUsername() {
    const username = usernameInput.value.trim();
    const isValid = username.length >= 2 && username.length <= 20;
    
    usernameInput.style.borderColor = isValid ? '' : '#e53e3e';
    
    if (isValid) {
        clearError();
    }
}

/**
 * Se connecte au serveur Socket.IO
 */
function connectToServer(username, token, room) {
    return new Promise((resolve, reject) => {
        // Créer la connexion avec le token dans la query string
        socket = io(SERVER_URL, {
            query: { token: token }
        });
        
        // Événements de connexion
        socket.on('connect', () => {
            console.log('✅ Connecté au serveur');
            
            // Envoyer les informations utilisateur
            socket.emit('user_connected', {
                username: username,
                room: room
            });
            
            resolve();
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Erreur de connexion:', error);
            reject(error);
        });
        
        // Configurer les écouteurs Socket.IO
        setupSocketListeners();
    });
}

/**
 * Configure les écouteurs Socket.IO
 */
function setupSocketListeners() {
    // Confirmation de connexion
    socket.on('user_connected_success', (data) => {
        console.log('✅ Connexion confirmée:', data);
        
        username = data.username;
        currentRoom = data.room;
        userColor = data.color;
        
        showEditorInterface();
    });
    
    // Gestion des erreurs
    socket.on('error', (data) => {
        console.error('❌ Erreur serveur:', data);
        
        // Gestion spéciale des erreurs de rate limiting et d'abus
        if (data.type === 'abuse_detected') {
            showError(`🚨 ${data.message}`);
            console.error('🚨 Abus détecté:', data.reason);
            
            // Déconnexion automatique après 3 secondes
            setTimeout(() => {
                showLoginInterface();
            }, 3000);
            return;
        }
        
        if (data.message && data.message.includes('rate limit')) {
            showError(`⚠️ ${data.message} - Veuillez ralentir vos actions`);
            return;
        }
        
        showError(data.message);
        
        if (data.type === 'auth_error') {
            // Retourner à l'écran de connexion
            showLoginInterface();
        }
    });
    
    // Notifications d'utilisateurs
    socket.on('notification', (data) => {
        console.log('📢 Notification:', data);
        showNotification(data);
    });
    
    // Liste des utilisateurs
    socket.on('users_list', (users) => {
        console.log('👥 Liste des utilisateurs:', users);
        updateUsersList(users);
    });
    
    // Mises à jour de l'éditeur
    socket.on('editor_update', (data) => {
        console.log('📝 Mise à jour éditeur:', data);
        applyEditorUpdate(data);
    });
    
    // Positions des curseurs
    socket.on('cursor_position', (data) => {
        console.log('👆 Position curseur:', data);
        updateRemoteCursor(data);
    });
    
    // Synchronisation complète
    socket.on('editor_sync', (data) => {
        console.log('🔄 Synchronisation:', data);
        syncEditorContent(data.content);
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
        console.log('🔌 Déconnecté du serveur');
        showLoginInterface();
        showError('Connexion perdue');
    });
}

/**
 * Affiche l'interface de l'éditeur
 */
function showEditorInterface() {
    loginSection.style.display = 'none';
    editorSection.style.display = 'flex';
    
    // Mettre à jour l'affichage
    currentRoomDisplay.textContent = currentRoom;
    currentUsernameDisplay.textContent = username;
    currentUsernameDisplay.style.backgroundColor = userColor;
    
    // Configurer l'éditeur
    setupEditor();
    
    // Demander la synchronisation
    socket.emit('editor_sync_request', { room: currentRoom });
}

/**
 * Affiche l'interface de connexion
 */
function showLoginInterface() {
    editorSection.style.display = 'none';
    loginSection.style.display = 'flex';
    
    // Réinitialiser les variables
    username = '';
    currentRoom = '';
    userColor = '';
    editorContent = '';
    
    // Fermer la connexion Socket.IO
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

/**
 * Configure l'éditeur collaboratif
 */
function setupEditor() {
    if (!collaborativeEditor) return;
    
    // Écouter les changements de contenu
    collaborativeEditor.addEventListener('input', handleEditorInput);
    
    // Écouter les changements de position du curseur
    collaborativeEditor.addEventListener('selectionchange', handleCursorChange);
    
    // Initialiser le compteur de caractères
    updateCharCount();
}

/**
 * Gère les changements dans l'éditeur
 */
function handleEditorInput(e) {
    if (isApplyingRemoteUpdate) return;
    
    const newContent = e.target.value;
    
    // Vérifier la limite de caractères
    if (newContent.length > MAX_EDITOR_LENGTH) {
        showError(`Limite de ${MAX_EDITOR_LENGTH} caractères atteinte`);
        collaborativeEditor.value = editorContent;
        return;
    }
    
    // Calculer le delta
    const delta = calculateDelta(editorContent, newContent);
    if (delta) {
        // Vérifier le rate limiting côté client
        if (!canSendEvent('editor_update')) {
            console.warn('⚠️ Événement éditeur ignoré - rate limit côté client');
            return;
        }
        
        // Sanitiser avec DOMPurify renforcé
        const sanitizedDelta = {
            ...delta,
            text: sanitizeString(delta.text || ''),
            username: sanitizeString(username),
            room: sanitizeString(currentRoom)
        };
        
        // Envoyer au serveur
        socket.emit('editor_update', sanitizedDelta);
    }
    
    // Mettre à jour le contenu local
    editorContent = newContent;
    updateCharCount();
}

/**
 * Gère les changements de position du curseur
 */
function handleCursorChange() {
    if (cursorUpdateTimeout) {
        clearTimeout(cursorUpdateTimeout);
    }
    
    cursorUpdateTimeout = setTimeout(() => {
        const position = collaborativeEditor.selectionStart;
        
        // Vérifier le rate limiting côté client
        if (!canSendEvent('cursor_position')) {
            console.warn('⚠️ Événement curseur ignoré - rate limit côté client');
            return;
        }
        
        socket.emit('cursor_position', {
            username: sanitizeString(username),
            position: position,
            room: sanitizeString(currentRoom)
        });
    }, CURSOR_UPDATE_DELAY);
}

/**
 * Calcule le delta entre deux contenus
 */
function calculateDelta(oldContent, newContent) {
    if (oldContent === newContent) return null;
    
    // Trouver la position de début du changement
    let startPos = 0;
    while (startPos < oldContent.length && startPos < newContent.length && 
           oldContent[startPos] === newContent[startPos]) {
        startPos++;
    }
    
    // Trouver la position de fin du changement
    let oldEnd = oldContent.length;
    let newEnd = newContent.length;
    while (oldEnd > startPos && newEnd > startPos && 
           oldContent[oldEnd - 1] === newContent[newEnd - 1]) {
        oldEnd--;
        newEnd--;
    }
    
    const deletedText = oldContent.substring(startPos, oldEnd);
    const insertedText = newContent.substring(startPos, newEnd);
    
    return {
        type: deletedText && insertedText ? 'replace' : (deletedText ? 'delete' : 'insert'),
        position: startPos,
        deletedLength: deletedText.length,
        text: insertedText
    };
}

/**
 * Applique une mise à jour distante de l'éditeur
 */
function applyEditorUpdate(data) {
    if (!data || !collaborativeEditor) return;
    
    isApplyingRemoteUpdate = true;
    
    try {
        // Sauvegarder la position du curseur
        const currentPosition = collaborativeEditor.selectionStart;
        
        // Appliquer le changement
        const beforeChange = editorContent.substring(0, data.position);
        const afterChange = editorContent.substring(data.position + data.deletedLength);
        const newContent = beforeChange + (data.text || '') + afterChange;
        
        // Mettre à jour l'éditeur
        collaborativeEditor.value = newContent;
        editorContent = newContent;
        
        // Ajuster la position du curseur
        let newPosition = currentPosition;
        if (data.position < currentPosition) {
            if (data.type === 'insert') {
                newPosition += data.text.length;
            } else if (data.type === 'delete') {
                newPosition -= data.deletedLength;
            } else if (data.type === 'replace') {
                newPosition = newPosition - data.deletedLength + data.text.length;
            }
        }
        
        // Restaurer la position du curseur
        collaborativeEditor.setSelectionRange(newPosition, newPosition);
        
        // Mettre à jour le compteur
        updateCharCount();
    } finally {
        isApplyingRemoteUpdate = false;
    }
}

/**
 * Synchronise le contenu de l'éditeur
 */
function syncEditorContent(content) {
    isApplyingRemoteUpdate = true;
    
    try {
        editorContent = content || '';
        collaborativeEditor.value = editorContent;
        updateCharCount();
    } finally {
        isApplyingRemoteUpdate = false;
    }
}

/**
 * Met à jour la position d'un curseur distant
 */
function updateRemoteCursor(data) {
    if (!cursorsOverlay || data.username === username) return;
    
    // Supprimer l'ancien curseur
    const existingCursor = cursorsOverlay.querySelector(`[data-username="${data.username}"]`);
    if (existingCursor) {
        existingCursor.remove();
    }
    
    // Calculer la position visuelle
    const textBeforeCursor = editorContent.substring(0, data.position);
    const lines = textBeforeCursor.split('\n');
    const line = lines.length - 1;
    const column = lines[lines.length - 1].length;
    
    // Créer l'élément curseur
    const cursorElement = document.createElement('div');
    cursorElement.className = 'remote-cursor';
    cursorElement.setAttribute('data-username', data.username);
    cursorElement.style.color = data.color;
    cursorElement.style.top = `${line * 21 + 20}px`; // 21px = line-height, 20px = padding
    cursorElement.style.left = `${column * 8.4 + 20}px`; // 8.4px = largeur moyenne caractère
    
    cursorsOverlay.appendChild(cursorElement);
    
    // Mettre à jour le compteur d'utilisateurs actifs
    updateActiveUsersCount();
}

/**
 * Met à jour la liste des utilisateurs
 */
function updateUsersList(users) {
    if (!usersList) return;
    
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        
        if (user.username === username) {
            userElement.classList.add('current-user');
        }
        
        userElement.innerHTML = `
            <span style="color: ${user.color}">${user.username}</span>
        `;
        
        usersList.appendChild(userElement);
    });
    
    // Mettre à jour le compteur
    activeUsersCount.textContent = users.length;
}

/**
 * Met à jour le compteur de caractères
 */
function updateCharCount() {
    if (charCount) {
        charCount.textContent = editorContent.length;
    }
    
    if (editorCharCount) {
        editorCharCount.textContent = editorContent.length;
    }
}

/**
 * Met à jour le compteur d'utilisateurs actifs
 */
function updateActiveUsersCount() {
    if (editorActiveUsers) {
        const activeCount = cursorsOverlay.children.length;
        editorActiveUsers.textContent = activeCount;
    }
}

/**
 * Affiche une notification
 */
function showNotification(data) {
    if (!notifications) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${data.type}`;
    
    let message = '';
    switch (data.type) {
        case 'user_joined':
            message = `👋 ${data.username} a rejoint la room`;
            break;
        case 'user_left':
            message = `👋 ${data.username} a quitté la room`;
            break;
        default:
            message = data.message || 'Notification';
    }
    
    notification.textContent = message;
    notifications.appendChild(notification);
    
    // Supprimer après 5 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

/**
 * Affiche une erreur
 */
function showError(message) {
    if (!errorMessage) return;
    
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Masquer après 5 secondes
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

/**
 * Efface l'erreur
 */
function clearError() {
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}

/**
 * Gère la déconnexion
 */
function handleDisconnect() {
    if (socket) {
        socket.disconnect();
    }
    
    showLoginInterface();
}

/**
 * Bascule entre le thème sombre (Call of Duty) et le thème clair
 */
function toggleTheme() {
    const body = document.body;
    const isDarkTheme = !body.classList.contains('white-theme');
    
    if (isDarkTheme) {
        // Passer au thème clair
        body.classList.add('white-theme');
        toggleThemeButton.textContent = '🌙 Mode sombre';
        toggleThemeButton.title = 'Basculer vers le mode sombre';
        
        // Sauvegarder la préférence
        localStorage.setItem('theme', 'light');
        
        console.log('🎨 Thème basculé vers le mode clair');
    } else {
        // Passer au thème sombre (Call of Duty)
        body.classList.remove('white-theme');
        toggleThemeButton.textContent = '☀️ Mode clair';
        toggleThemeButton.title = 'Basculer vers le mode clair';
        
        // Sauvegarder la préférence
        localStorage.setItem('theme', 'dark');
        
        console.log('🎮 Thème basculé vers le mode Call of Duty');
    }
}

/**
 * Charge le thème sauvegardé au démarrage
 */
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'light') {
        document.body.classList.add('white-theme');
        toggleThemeButton.textContent = '🌙 Mode sombre';
        toggleThemeButton.title = 'Basculer vers le mode sombre';
    } else {
        // Thème sombre par défaut
        toggleThemeButton.textContent = '☀️ Mode clair';
        toggleThemeButton.title = 'Basculer vers le mode clair';
    }
}

/**
 * Configure la sélection d'espace de travail
 */
function setupRoomSelection() {
    const roomCards = document.querySelectorAll('.room-card');
    const roomSelect = document.getElementById('roomSelect');
    
    roomCards.forEach(card => {
        card.addEventListener('click', () => {
            // Retirer la sélection de toutes les cartes
            roomCards.forEach(c => c.classList.remove('selected'));
            
            // Ajouter la sélection à la carte cliquée
            card.classList.add('selected');
            
            // Mettre à jour le champ caché
            const roomValue = card.getAttribute('data-room');
            roomSelect.value = roomValue;
            
            // Effacer les erreurs
            clearError();
            
            console.log('🎯 Espace de travail sélectionné:', roomValue);
        });
        
        // Effet de survol avec animation
        card.addEventListener('mouseenter', () => {
            if (!card.classList.contains('selected')) {
                card.style.transform = 'translateY(-2px) scale(1.02)';
            }
        });
        
        card.addEventListener('mouseleave', () => {
            if (!card.classList.contains('selected')) {
                card.style.transform = 'translateY(0) scale(1)';
            }
        });
    });
}

/**
 * Met à jour le nombre d'utilisateurs pour chaque room
 */
function updateRoomUsersCount(roomsData) {
    const roomCards = document.querySelectorAll('.room-card');
    
    roomCards.forEach(card => {
        const roomValue = card.getAttribute('data-room');
        const roomData = roomsData.find(room => room.name === roomValue);
        const usersElement = card.querySelector('.room-users');
        
        if (roomData && usersElement) {
            usersElement.textContent = roomData.users || 0;
            
            // Animation si des utilisateurs sont présents
            if (roomData.users > 0) {
                usersElement.style.animation = 'pulse 1s ease-in-out';
                setTimeout(() => {
                    usersElement.style.animation = '';
                }, 1000);
            }
        }
    });
}

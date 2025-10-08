const PORT = 3000;
let socket = null;
let username = '';
let currentRoom = '';
let userColor = '';
let privateMessageTarget = null; // Utilisateur cible pour les messages privés

// Fonction utilitaire pour extraire les données malformées
function extractUserData(data) {
    let username = '';
    let room = '';
    
    if (data && typeof data === 'object') {
        // Si data.username est un objet, essayer d'extraire le nom
        if (typeof data.username === 'object' && data.username !== null) {
            const usernameStr = JSON.stringify(data.username);
            const match = usernameStr.match(/username["\s]*:["\s]*"([^"]+)"/);
            if (match) {
                username = match[1];
            } else {
                username = 'Utilisateur inconnu';
            }
        } else if (typeof data.username === 'string') {
            username = data.username;
        }
        
        // Si data.room est undefined, essayer de l'extraire de data.username
        if (data.room) {
            room = data.room;
        } else if (typeof data.username === 'object') {
            const usernameStr = JSON.stringify(data.username);
            const roomMatch = usernameStr.match(/room["\s]*:["\s]*"([^"]+)"/);
            if (roomMatch) {
                room = roomMatch[1];
            }
        }
    }
    
    return { username, room };
}

// Éléments DOM
const loginSection = document.getElementById('loginSection');
const chatSection = document.getElementById('chatSection');
const usernameInput = document.getElementById('usernameInput');
const connectButton = document.getElementById('connectButton');
const inputMessage = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messages = document.getElementById('messages');
const usersListItems = document.getElementById('usersListItems');

// Fonction pour nettoyer l'affichage d'erreur
function clearUsernameError() {
    const errorDiv = document.getElementById('usernameError');
    if (errorDiv) {
        errorDiv.remove();
    }
    usernameInput.style.borderColor = '';
    usernameInput.style.backgroundColor = '';
}

// Nettoyer l'erreur quand l'utilisateur tape
usernameInput.addEventListener('input', clearUsernameError);

// Gestion de la connexion avec pseudonyme et room
connectButton.addEventListener('click', () => {
    const enteredUsername = usernameInput.value.trim();
    const selectedRoom = document.querySelector('input[name="room"]:checked')?.value;
    
    if (enteredUsername === '') {
        alert('Veuillez entrer un pseudonyme');
        return;
    }
    
    if (enteredUsername.length < 2) {
        alert('Le pseudonyme doit contenir au moins 2 caractères');
        return;
    }
    
    if (!selectedRoom) {
        alert('Veuillez sélectionner une room');
        return;
    }
    
    username = enteredUsername;
    currentRoom = selectedRoom;
    
    // Connexion au serveur
    socket = io(`http://localhost:${PORT}`);
    
    // Configurer les écouteurs d'événements après la connexion
    setupSocketListeners();
    
    // Envoyer le pseudonyme et la room au serveur lors de la connexion
    socket.emit('user_connected', { username, room: selectedRoom });
    
    // Masquer la section de connexion et afficher le chat
    loginSection.style.display = 'none';
    chatSection.style.display = 'block';
    
    // Mettre à jour l'affichage de la room actuelle
    document.getElementById('currentRoomDisplay').textContent = currentRoom;
    
    // Focus sur le champ de message
    inputMessage.focus();
});

// Fonction pour configurer les écouteurs d'événements Socket.IO
function setupSocketListeners() {
    // Écouter les messages reçus des autres utilisateurs
    // (Socket.IO gère automatiquement l'isolation par room)
    socket.on('message', (data) => {
        console.log('Message reçu d\'un autre utilisateur:', data);
        const li = document.createElement('li');
        
        // Créer le message avec la couleur de l'utilisateur
        const coloredUsername = `<span style="color: ${data.color}">${data.username}</span>`;
        li.innerHTML = `${coloredUsername}: ${data.message}`;
        
        messages.appendChild(li);
        messages.scrollTop = messages.scrollHeight;
    });

    // Écouter les notifications de connexion/déconnexion
    socket.on('user_joined', (data) => {
        console.log('Notification user_joined reçue:', data);
        if (data && data.username) {
            const li = document.createElement('li');
            const coloredUsername = `<span style="color: ${data.color}">${data.username}</span>`;
            li.innerHTML = `🔵 ${coloredUsername} a rejoint la room`;
            li.style.color = '#1da1f2';
            li.style.fontStyle = 'italic';
            messages.appendChild(li);
        } else {
            console.error('Données user_joined invalides:', data);
        }
    });

    socket.on('user_left', (data) => {
        console.log('Notification user_left reçue:', data);
        if (data && data.username) {
            const li = document.createElement('li');
            const coloredUsername = `<span style="color: ${data.color || '#666'}">${data.username}</span>`;
            li.innerHTML = `🔴 ${coloredUsername} a quitté la room`;
            li.style.color = '#f44336';
            li.style.fontStyle = 'italic';
            messages.appendChild(li);
        } else {
            console.error('Données user_left invalides:', data);
        }
    });

    // Gestion des mises à jour de la liste des utilisateurs
    socket.on('users', (userList) => {
        console.log('Liste des utilisateurs reçue:', userList);

        // Vider la liste actuelle
        usersListItems.innerHTML = '';

        // Vérifier que userList est un tableau
        if (!Array.isArray(userList)) {
            console.error('userList n\'est pas un tableau:', userList);
            return;
        }

        // Ajouter chaque utilisateur à la liste
        userList.forEach(user => {
            const li = document.createElement('li');
            
            // Gérer les deux formats : string (ancien) ou object (nouveau avec couleur)
            let userName, userColor;
            if (typeof user === 'string') {
                userName = user;
                userColor = '#666'; // Couleur par défaut
            } else {
                userName = user.username;
                userColor = user.color;
            }

            // Créer le nom d'utilisateur avec sa couleur
            const coloredUsername = `<span style="color: ${userColor}">${userName}</span>`;
            
            // Mettre en évidence l'utilisateur actuel
            if (userName === username) {
                li.style.fontWeight = 'bold';
                li.style.backgroundColor = '#e8f5e8';
                li.innerHTML = `${coloredUsername} <span style="color: black;">(vous)</span>`;
                // Stocker la couleur de l'utilisateur actuel
                window.userColor = userColor;
            } else {
                // Rendre le nom d'utilisateur cliquable pour les messages privés
                li.innerHTML = coloredUsername;
                li.style.cursor = 'pointer';
                li.title = `Cliquer pour envoyer un message privé à ${userName}`;
                
                // Ajouter l'événement de clic pour les messages privés
                li.addEventListener('click', () => {
                    setPrivateMessageTarget(userName, userColor);
                });
            }

            usersListItems.appendChild(li);
        });

        // Afficher le nombre d'utilisateurs connectés dans la room
        const usersListTitle = document.querySelector('#usersList h3');
        usersListTitle.textContent = `Room ${currentRoom} - Utilisateurs (${userList.length})`;
    });
    
    // Gestion du changement de room
    socket.on('room_changed', (data) => {
        console.log('Changement de room:', data);
        
        // Mettre à jour la room actuelle
        currentRoom = data.newRoom;
        
        // Afficher le message de confirmation
        const li = document.createElement('li');
        li.innerHTML = `🔄 <span style="color: #4CAF50; font-weight: bold;">${data.message}</span>`;
        li.style.fontStyle = 'italic';
        li.style.backgroundColor = '#f0f8ff';
        li.style.padding = '8px';
        li.style.borderRadius = '5px';
        li.style.margin = '5px 0';
        messages.appendChild(li);
        messages.scrollTop = messages.scrollHeight;
        
        // Mettre à jour le titre de la liste des utilisateurs
        const usersListTitle = document.querySelector('#usersList h3');
        usersListTitle.textContent = `Room ${currentRoom} - Utilisateurs`;
        
        // Mettre à jour l'affichage de la room actuelle
        document.getElementById('currentRoomDisplay').textContent = currentRoom;
    });
    
    // Gestion des messages privés
    socket.on('private_message', (data) => {
        console.log('🔒 MESSAGE PRIVÉ REÇU:', data);
        console.log('🔒 Expéditeur:', data.username);
        console.log('🔒 Message:', data.message);
        console.log('🔒 Couleur expéditeur:', data.color);
        
        const li = document.createElement('li');
        
        // Créer le message privé avec la couleur de l'expéditeur
        const coloredUsername = `<span style="color: ${data.color}">${data.username}</span>`;
        li.innerHTML = `🔒 ${coloredUsername} (privé): ${data.message}`;
        li.style.backgroundColor = '#fff3cd';
        li.style.borderLeft = '4px solid #ffc107';
        li.style.padding = '8px';
        li.style.margin = '5px 0';
        li.style.borderRadius = '5px';
        li.style.color = 'black'; // Texte en noir au lieu de blanc
        
        messages.appendChild(li);
        messages.scrollTop = messages.scrollHeight;
    });

    // Gestion des erreurs
    socket.on('error', (data) => {
        console.log('Erreur reçue du serveur:', data);
        
        // Gestion spéciale pour les pseudonymes déjà utilisés
        if (data.type === 'username_taken') {
            // Réafficher la section de connexion
            loginSection.style.display = 'block';
            chatSection.style.display = 'none';
            
            // Mettre en évidence le champ de pseudonyme
            usernameInput.style.borderColor = '#f44336';
            usernameInput.style.backgroundColor = '#ffebee';
            usernameInput.focus();
            usernameInput.select();
            
            // Afficher un message d'erreur plus visible
            const errorDiv = document.createElement('div');
            errorDiv.id = 'usernameError';
            errorDiv.style.cssText = `
                color: #f44336;
                background-color: #ffebee;
                border: 1px solid #f44336;
                border-radius: 4px;
                padding: 10px;
                margin: 10px 0;
                font-weight: bold;
            `;
            errorDiv.textContent = `❌ ${data.message}`;
            
            // Supprimer l'ancien message d'erreur s'il existe
            const existingError = document.getElementById('usernameError');
            if (existingError) {
                existingError.remove();
            }
            
            // Insérer le message d'erreur après le champ de pseudonyme
            usernameInput.parentNode.insertBefore(errorDiv, usernameInput.nextSibling);
            
            // Déconnecter le socket pour éviter les problèmes
            if (socket) {
                socket.disconnect();
                socket = null;
            }
        } else {
            // Erreurs générales
            alert(`Erreur: ${data.message}`);
        }
    });
}

// Fonction pour définir la cible des messages privés
function setPrivateMessageTarget(targetUsername, targetColor) {
    privateMessageTarget = targetUsername;
    
    // Mettre à jour l'interface pour indiquer le mode message privé
    const messageInput = document.getElementById('messageInput');
    messageInput.placeholder = `Message privé à ${targetUsername}...`;
    messageInput.style.backgroundColor = '#fff3cd';
    messageInput.style.borderColor = '#ffc107';
    messageInput.style.color = 'black'; // Texte en noir pour le mode privé
    
    // Afficher un message d'information
    const li = document.createElement('li');
    li.innerHTML = `🔒 <span style="color: #ffc107; font-weight: bold;">Mode message privé activé avec ${targetUsername}</span>`;
    li.style.fontStyle = 'italic';
    li.style.backgroundColor = '#fff3cd';
    li.style.padding = '8px';
    li.style.borderRadius = '5px';
    li.style.margin = '5px 0';
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
}

// Fonction pour désactiver le mode message privé
function disablePrivateMessageMode() {
    privateMessageTarget = null;
    
    // Remettre l'interface normale
    const messageInput = document.getElementById('messageInput');
    messageInput.placeholder = 'Tapez votre message ici...';
    messageInput.style.backgroundColor = '#253341';
    messageInput.style.borderColor = '#2f3336';
    messageInput.style.color = '#ffffff'; // Texte blanc pour le mode normal
}

// Gestion de l'envoi de messages
sendButton.addEventListener('click', () => {
    if (inputMessage.value && inputMessage.value.trim() !== '') {
        const messageText = inputMessage.value;
        
        // Vérifier si c'est une commande /room
        if (messageText.startsWith('/room ')) {
            const newRoom = messageText.substring(6).trim();
            const messageData = {
                username: username,
                message: messageText
            };

            // Envoyer la commande au serveur
            socket.emit('message', messageData);
            
            // Afficher la commande dans le chat
            const li = document.createElement('li');
            const coloredUsername = `<span style="color: ${window.userColor || '#666'}">${username}</span>`;
            li.innerHTML = `${coloredUsername}: ${messageText}`;
            li.style.fontStyle = 'italic';
            li.style.color = '#666';
            messages.appendChild(li);
            messages.scrollTop = messages.scrollHeight;
            
            inputMessage.value = '';
            return;
        }
        
        // Vérifier si c'est une commande pour désactiver le mode privé
        if (messageText === '/public' || messageText === '/room') {
            disablePrivateMessageMode();
            
            // Afficher un message de confirmation
            const li = document.createElement('li');
            li.innerHTML = `🌐 <span style="color: #4CAF50; font-weight: bold;">Mode message public activé</span>`;
            li.style.fontStyle = 'italic';
            li.style.backgroundColor = '#f0f8ff';
            li.style.padding = '8px';
            li.style.borderRadius = '5px';
            li.style.margin = '5px 0';
            messages.appendChild(li);
            messages.scrollTop = messages.scrollHeight;
            
            inputMessage.value = '';
            return;
        }
        
        // Vérifier si on est en mode message privé
        if (privateMessageTarget) {
            // Message privé
            const privateMessageData = {
                username: username,
                message: messageText,
                target: privateMessageTarget
            };

            // Envoyer le message privé au serveur
            console.log('🔒 ENVOI MESSAGE PRIVÉ:', privateMessageData);
            socket.emit('private_message', privateMessageData);

            // Afficher immédiatement son propre message privé
            const li = document.createElement('li');
            const coloredUsername = `<span style="color: ${window.userColor || '#666'}">${username}</span>`;
            li.innerHTML = `🔒 ${coloredUsername} → ${privateMessageTarget} (privé): ${messageText}`;
            li.style.backgroundColor = '#fff3cd';
            li.style.borderLeft = '4px solid #ffc107';
            li.style.padding = '8px';
            li.style.margin = '5px 0';
            li.style.borderRadius = '5px';
            li.style.color = 'black'; // Texte en noir au lieu de blanc
            messages.appendChild(li);
            messages.scrollTop = messages.scrollHeight;
        } else {
            // Message normal
            const messageData = {
                username: username,
                message: messageText
            };

            // Envoyer le message au serveur
            socket.emit('message', messageData);

            // Afficher immédiatement son propre message (car socket.to() ne l'envoie pas à soi-même)
            const li = document.createElement('li');
            const coloredUsername = `<span style="color: ${window.userColor || '#666'}">${username}</span>`;
            li.innerHTML = `${coloredUsername}: ${messageText}`;
            messages.appendChild(li);
            messages.scrollTop = messages.scrollHeight;
        }

        inputMessage.value = '';
    }
});

// Gestion de la touche Entrée pour envoyer
inputMessage.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});
# Bonnes pratiques Socket.IO - Gestion des Rooms

## Concepts clés

### 1. Rooms = Isolation automatique
- Une **room** est gérée nativement par Socket.IO
- Quand vous faites `socket.to(room).emit()`, seuls les membres de cette room reçoivent le message
- **Pas besoin d'inclure la room dans les données** - Socket.IO gère l'isolation

### 2. Pattern de communication

#### Serveur
```javascript
io.on('connection', (socket) => {
    // 1. Rejoindre une room
    socket.join('room1');
    
    // 2. Diffuser aux AUTRES membres de la room
    socket.to('room1').emit('message', data);
    
    // 3. Diffuser à TOUS (y compris soi-même)
    io.to('room1').emit('message', data);
});
```

#### Client
```javascript
// Émettre un message
socket.emit('message', { username: 'Alice', message: 'Bonjour' });

// Recevoir un message (uniquement de sa room)
socket.on('message', (data) => {
    console.log(data); // Socket.IO a déjà filtré par room
});
```

## Implémentation dans notre chat

### Serveur (server.js)

```javascript
// Connexion et ajout à une room
socket.on('user_connected', (data) => {
    const { username, room } = data;
    
    socket.username = username;
    socket.room = room;
    
    // Rejoindre la room
    socket.join(room);
    
    // Notifier les AUTRES membres
    socket.to(room).emit('user_joined', { username });
});

// Envoi de message
socket.on('message', (msg) => {
    // Envoyer aux AUTRES membres de la room
    socket.to(socket.room).emit('message', msg);
});
```

### Client (scriptClient.js)

```javascript
// Envoi d'un message
sendButton.addEventListener('click', () => {
    const messageData = {
        username: username,
        message: inputMessage.value
    };
    
    // Envoyer au serveur
    socket.emit('message', messageData);
    
    // Afficher son propre message (car socket.to() ne l'envoie pas à soi-même)
    afficherMessage(messageData);
});

// Réception des messages des AUTRES
socket.on('message', (data) => {
    afficherMessage(data);
});
```

## Pourquoi cette approche ?

### ✅ Avantages
1. **Performance** : Le serveur filtre automatiquement
2. **Sécurité** : Impossible de recevoir des messages d'autres rooms
3. **Simplicité** : Code plus clair et maintenable
4. **Standards** : Respect des bonnes pratiques Socket.IO

### ❌ À éviter
```javascript
// ❌ BAD : Inclure la room dans le message
socket.emit('message', { username, message, room });

// ❌ BAD : Filtrer côté client
socket.on('message', (data) => {
    if (data.room === myRoom) { // Inutile !
        afficherMessage(data);
    }
});

// ❌ BAD : Diffuser à tout le monde
io.emit('message', data); // Envoie à TOUTES les rooms
```

### ✅ Correct
```javascript
// ✅ GOOD : Pas de room dans le message
socket.emit('message', { username, message });

// ✅ GOOD : Pas de filtrage côté client
socket.on('message', (data) => {
    afficherMessage(data); // Socket.IO a déjà filtré
});

// ✅ GOOD : Diffuser uniquement à la room
socket.to(socket.room).emit('message', data);
```

## Résumé

| Action | Méthode | Destinataires |
|--------|---------|---------------|
| Envoyer aux autres de la room | `socket.to(room).emit()` | Autres membres uniquement |
| Envoyer à tous de la room | `io.to(room).emit()` | Tous les membres (y compris soi) |
| Envoyer à tout le monde | `io.emit()` | Tous les clients connectés |
| Envoyer à soi-même | `socket.emit()` | Le client lui-même |

## Architecture de notre application

```
Client 1 (room: general) ─┐
Client 2 (room: general) ─┼─> Room "general"
                          │
Client 3 (room: tech)    ─┼─> Room "tech"
Client 4 (room: tech)    ─┘
```

- Les messages de "general" ne vont QUE dans "general"
- Les messages de "tech" ne vont QUE dans "tech"
- Socket.IO gère automatiquement cette isolation


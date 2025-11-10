# 🔐 Documentation de Sécurité

Ce document détaille toutes les mesures de sécurité implémentées dans l'application de Tableau de Bord Collaboratif.

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Authentification](#authentification)
3. [Autorisation](#autorisation)
4. [Protection des Données](#protection-des-données)
5. [WebSockets Sécurisés](#websockets-sécurisés)
6. [Validation des Entrées](#validation-des-entrées)
7. [Prévention XSS](#prévention-xss)
8. [Bonnes Pratiques](#bonnes-pratiques)
9. [Checklist de Sécurité](#checklist-de-sécurité)

## Vue d'Ensemble

L'application implémente un système de sécurité complet basé sur :
- **Authentification** : JWT (JSON Web Tokens)
- **Hashage** : bcrypt avec 10 rounds de salage
- **Autorisation** : Vérification de propriété des ressources
- **Validation** : Côté serveur et client
- **Protection XSS** : Échappement des entrées utilisateur

## Authentification

### 1. Hashage des Mots de Passe

**Implémentation** (`server/index.js`, ligne 176) :

```javascript
const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
```

- **Algorithme** : bcrypt
- **Rounds** : 10 (SALT_ROUNDS = 10)
- **Jamais de stockage en clair** : Le mot de passe n'est jamais stocké ou transmis en clair

**Vérification** (`server/index.js`, ligne 235) :

```javascript
const isPasswordValid = await bcrypt.compare(password, user.password);
```

### 2. JSON Web Tokens (JWT)

**Génération du Token** (`server/index.js`, lignes 193-197) :

```javascript
const token = jwt.sign(
    { userId: newUser.id, username: newUser.username },
    JWT_SECRET,
    { expiresIn: '24h' }
);
```

**Contenu du Token** :
- `userId` : ID unique de l'utilisateur
- `username` : Nom d'utilisateur
- `exp` : Date d'expiration (24h)
- `iat` : Date de création

**Secret JWT** :
⚠️ **À CHANGER EN PRODUCTION** : Utiliser une variable d'environnement avec un secret fort et aléatoire.

```bash
export JWT_SECRET="votre_secret_aleatoire_tres_long_et_complexe"
```

### 3. Middleware d'Authentification

**Implémentation** (`server/index.js`, lignes 125-143) :

```javascript
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide ou expiré' });
        }
        req.user = user;
        next();
    });
}
```

**Utilisation** :
```javascript
app.post('/notes', authenticateToken, async (req, res) => {
    // req.user contient { userId, username }
});
```

## Autorisation

### 1. Vérification de Propriété

**Principe** : Un utilisateur ne peut modifier/supprimer que ses propres notes.

**Implémentation - Modification** (`server/index.js`, lignes 334-341) :

```javascript
// Trouver la note
const noteIndex = notes.findIndex(note => note.id === noteId);
if (noteIndex === -1) {
    return res.status(404).json({ error: 'Note non trouvée' });
}

// Vérifier que l'utilisateur est le propriétaire de la note
if (notes[noteIndex].authorId !== req.user.userId) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres notes' });
}
```

**Codes HTTP** :
- `401 Unauthorized` : Token manquant
- `403 Forbidden` : Token invalide ou action non autorisée
- `404 Not Found` : Ressource introuvable

### 2. Association Utilisateur-Note

Chaque note contient :
```javascript
{
    id: 1,
    content: "Contenu de la note",
    authorId: 1,              // ← ID de l'auteur
    authorUsername: "john",   // ← Nom pour affichage
    createdAt: "...",
    updatedAt: "..."
}
```

L'`authorId` est automatiquement assigné lors de la création :
```javascript
const newNote = {
    id: noteIdCounter++,
    content: content.trim(),
    authorId: req.user.userId,        // ← Depuis le JWT
    authorUsername: req.user.username,
    ...
};
```

## Protection des Données

### 1. Persistance Sécurisée

**Fichiers JSON** :
- `server/users.json` : Utilisateurs avec mots de passe hashés
- `server/notes.json` : Notes avec authorId

**Permissions** :
- Les fichiers doivent être protégés en lecture/écriture
- En production, utiliser une base de données avec chiffrement

### 2. Données Sensibles

**Jamais exposées** :
- Mots de passe hashés (jamais renvoyés dans les réponses)
- Secret JWT (jamais exposé côté client)

**Exemple de réponse sécurisée** :
```javascript
res.status(201).json({
    message: 'Utilisateur créé avec succès',
    token: token,
    user: {
        id: newUser.id,
        username: newUser.username,
        createdAt: newUser.createdAt
        // ⚠️ Pas de mot de passe !
    }
});
```

## WebSockets Sécurisés

### 1. Middleware Socket.IO

**Implémentation** (`server/index.js`, lignes 380-397) :

```javascript
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Token d\'authentification requis pour Socket.IO'));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error('Token invalide ou expiré'));
        }

        // Attacher les informations utilisateur au socket
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        next();
    });
});
```

### 2. Connexion Client

**Implémentation** (`public/app.js`, lignes 147-152) :

```javascript
function connectSocket() {
    socket = io({
        auth: {
            token: token  // ← JWT depuis localStorage
        }
    });
    
    // ...
}
```

### 3. Gestion des Erreurs

```javascript
socket.on('connect_error', (error) => {
    console.error('❌ Erreur de connexion Socket.IO:', error.message);
    
    if (error.message.includes('Token')) {
        showMessage('Session expirée, veuillez vous reconnecter', 'error');
        setTimeout(logout, 2000);
    }
});
```

## Validation des Entrées

### 1. Validation Serveur

**Règles** :
- Username : minimum 3 caractères
- Password : minimum 6 caractères
- Content : maximum 1000 caractères
- Types vérifiés avec `typeof`

**Exemple** (`server/index.js`, lignes 158-169) :

```javascript
if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
}

if (username.length < 3) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' });
}

if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
}
```

### 2. Validation Client

**Attributs HTML** :
```html
<input 
    type="text" 
    required
    minlength="3"
    maxlength="20"
>
```

**Validation JavaScript** (`public/index.html`, lignes 126-135) :

```javascript
if (username.length < 3) {
    showMessage('Le nom d\'utilisateur doit contenir au moins 3 caractères', 'error');
    return;
}

if (password.length < 6) {
    showMessage('Le mot de passe doit contenir au moins 6 caractères', 'error');
    return;
}
```

## Prévention XSS

### 1. Échappement HTML

**Fonction d'échappement** (`public/app.js`, lignes 587-597) :

```javascript
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]).replace(/\n/g, '<br>');
}
```

### 2. Utilisation

**Affichage des notes** (`public/app.js`, ligne 481) :

```javascript
<div class="note-content">
    ${escapeHtml(note.content)}  // ← Échappement XSS
</div>
```

**Ce qui est protégé** :
```javascript
// Entrée malveillante :
"<script>alert('XSS')</script>"

// Après échappement :
"&lt;script&gt;alert('XSS')&lt;/script&gt;"
```

### 3. Pas de innerHTML Direct

❌ **Mauvaise pratique** :
```javascript
element.innerHTML = userContent;  // Risque XSS !
```

✅ **Bonne pratique** :
```javascript
element.innerHTML = escapeHtml(userContent);
```

## Bonnes Pratiques

### 1. Côté Serveur

✅ **Implémenté** :
- Validation de toutes les entrées
- Hashage des mots de passe avec bcrypt
- JWT avec expiration
- Vérification de propriété avant modification/suppression
- Messages d'erreur non révélateurs
- Persistance des données

⚠️ **À améliorer en production** :
- Externaliser le secret JWT en variable d'environnement
- Ajouter du rate limiting (limiter les tentatives de connexion)
- Utiliser HTTPS en production
- Implémenter des logs de sécurité
- Base de données au lieu de JSON
- Backup automatique des données

### 2. Côté Client

✅ **Implémenté** :
- Validation avant envoi
- Échappement XSS
- Stockage sécurisé du token (localStorage)
- Envoi du token dans les headers
- Gestion des erreurs d'authentification
- Déconnexion automatique si token invalide

⚠️ **Limitations** :
- localStorage accessible par JavaScript (risque XSS si injection)
- Pas de refresh token
- Pas de détection de session multiple

### 3. Configuration Production

**Variables d'environnement recommandées** :

```bash
# Serveur
export PORT=3000
export JWT_SECRET="votre_secret_aleatoire_tres_long_minimum_256_bits"
export NODE_ENV="production"

# Base de données (future implémentation)
export DB_HOST="localhost"
export DB_USER="app_user"
export DB_PASSWORD="mot_de_passe_complexe"
```

**Serveur HTTPS** :
```javascript
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('private-key.pem'),
    cert: fs.readFileSync('certificate.pem')
};

const server = https.createServer(options, app);
```

## Checklist de Sécurité

### Authentification
- ✅ Mots de passe hashés avec bcrypt
- ✅ JWT avec expiration
- ✅ Secret JWT configurable
- ✅ Vérification du token sur toutes les routes protégées
- ⚠️ Secret JWT à externaliser en production
- ❌ Pas de refresh token (à implémenter)
- ❌ Pas de rate limiting (à implémenter)

### Autorisation
- ✅ Vérification de propriété avant modification/suppression
- ✅ Codes HTTP appropriés (401, 403, 404)
- ✅ Messages d'erreur non révélateurs
- ✅ Données utilisateur attachées au token JWT

### Protection des Données
- ✅ Persistance sécurisée
- ✅ Mots de passe jamais exposés
- ✅ Données sensibles jamais renvoyées au client
- ⚠️ Fichiers JSON à remplacer par une vraie DB en production

### WebSockets
- ✅ Authentification JWT sur Socket.IO
- ✅ Vérification du token à la connexion
- ✅ Informations utilisateur attachées au socket
- ✅ Gestion des erreurs de connexion

### Validation
- ✅ Validation côté serveur
- ✅ Validation côté client
- ✅ Limites de taille
- ✅ Vérification des types

### XSS
- ✅ Échappement HTML de tout contenu utilisateur
- ✅ Pas d'utilisation directe de innerHTML
- ✅ Fonction escapeHtml() dédiée

### HTTPS/Transport
- ❌ HTTPS non implémenté (à activer en production)
- ❌ HSTS non configuré

### Logging & Monitoring
- ✅ Logs basiques (console.log)
- ❌ Pas de système de logging avancé
- ❌ Pas de monitoring de sécurité
- ❌ Pas d'alertes

## Scénarios d'Attaque Prévenus

### 1. Vol de Mot de Passe
**Attaque** : Un attaquant accède à `users.json`

**Protection** :
- Mots de passe hashés avec bcrypt
- Impossible de retrouver le mot de passe original
- Nécessite des années pour bruteforce un hash bcrypt

### 2. Token Forgé
**Attaque** : Un attaquant tente de créer un faux token JWT

**Protection** :
- Token signé avec secret fort
- Vérification de la signature à chaque requête
- Impossible de forger sans le secret

### 3. Modification de Note d'Autrui
**Attaque** : Alice tente de modifier une note de Bob

**Protection** :
- Vérification de `authorId === req.user.userId`
- Réponse 403 Forbidden
- Pas de bouton d'édition affiché côté client

### 4. Injection XSS
**Attaque** : Un attaquant injecte `<script>alert('XSS')</script>` dans une note

**Protection** :
- Échappement HTML avec `escapeHtml()`
- Le script est affiché comme texte, pas exécuté
- Tous les caractères dangereux sont encodés

### 5. Replay Attack
**Attaque** : Un attaquant réutilise un ancien token

**Protection** :
- Token avec expiration (24h)
- Après 24h, le token est invalide
- Nécessite une nouvelle authentification

## Recommandations Finales

### Pour le Développement
1. Utiliser des variables d'environnement pour tous les secrets
2. Activer les logs détaillés
3. Tester avec plusieurs utilisateurs simultanés
4. Vérifier les permissions sur les fichiers

### Pour la Production
1. **OBLIGATOIRE** : Changer le secret JWT
2. **OBLIGATOIRE** : Activer HTTPS
3. **RECOMMANDÉ** : Implémenter le rate limiting
4. **RECOMMANDÉ** : Utiliser une vraie base de données
5. **RECOMMANDÉ** : Mettre en place des backups automatiques
6. **RECOMMANDÉ** : Activer les logs de sécurité
7. **RECOMMANDÉ** : Implémenter le refresh token

### Ressources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [bcrypt Documentation](https://www.npmjs.com/package/bcrypt)
- [Socket.IO Authentication](https://socket.io/docs/v4/middlewares/)

---

**Dernière mise à jour** : Novembre 2024


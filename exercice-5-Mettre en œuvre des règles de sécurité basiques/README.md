# 📌 Tableau de Bord Collaboratif Sécurisé

Application de notes collaboratives en temps réel avec authentification JWT et autorisation basée sur la propriété des données.

## 🎯 Objectifs Pédagogiques

- Mettre en œuvre l'authentification avec JWT (JSON Web Tokens)
- Implémenter l'autorisation basée sur la propriété des données
- Sécuriser les WebSockets avec authentification
- Utiliser bcrypt pour le hashage des mots de passe
- Gérer les sessions utilisateur côté client avec localStorage

## ✨ Fonctionnalités

### Authentification & Autorisation
- ✅ Inscription avec validation des données
- ✅ Connexion sécurisée avec JWT
- ✅ Hashage des mots de passe avec bcrypt (10 rounds)
- ✅ Tokens JWT avec expiration (24h)
- ✅ Protection des routes API avec middleware d'authentification
- ✅ Vérification de propriété avant modification/suppression

### Gestion des Notes
- ✅ Créer des notes (authentification requise)
- ✅ Voir toutes les notes (lecture publique)
- ✅ Modifier ses propres notes uniquement
- ✅ Supprimer ses propres notes uniquement
- ✅ Synchronisation en temps réel avec Socket.IO

### Interface Utilisateur
- ✅ Design moderne et responsive
- ✅ Effet Post-it pour les notes (couleurs, rotation, ombres)
- ✅ Filtres : Toutes, Mes notes, Autres
- ✅ Statistiques en temps réel
- ✅ Modals d'édition et de confirmation
- ✅ Indicateur de connexion Socket.IO

## 🏗️ Architecture

```
exercice-8-Mettre en œuvre des règles de sécurité basiques/
├── server/
│   ├── index.js          # Serveur Express + Socket.IO
│   ├── package.json      # Dépendances backend
│   ├── users.json        # Persistance des utilisateurs
│   └── notes.json        # Persistance des notes
├── public/
│   ├── index.html        # Page d'authentification
│   ├── app.html          # Tableau de bord
│   ├── app.js            # Logique client
│   └── style.css         # Styles CSS
└── README.md
```

## 🔐 Sécurité Implémentée

### Backend
1. **Authentification JWT**
   - Tokens signés avec secret fort
   - Expiration après 24h
   - Vérification sur toutes les routes protégées

2. **Hashage des Mots de Passe**
   - Utilisation de bcrypt avec 10 rounds de salage
   - Jamais de stockage en clair

3. **Autorisation**
   - Vérification de l'identité via `req.user.userId`
   - Comparaison avec `note.authorId` avant modification/suppression
   - Messages d'erreur appropriés (403 Forbidden)

4. **Validation des Données**
   - Validation côté serveur de toutes les entrées
   - Limites de taille (username ≥3, password ≥6, content ≤1000)
   - Vérification des types

5. **Socket.IO Sécurisé**
   - Middleware d'authentification JWT
   - Vérification du token dans `socket.handshake.auth.token`
   - Informations utilisateur attachées au socket

### Frontend
1. **Échappement XSS**
   - Fonction `escapeHtml()` pour tout contenu utilisateur
   - Prévention des injections de scripts

2. **Validation Côté Client**
   - Validation des formulaires avant envoi
   - Feedback visuel immédiat

3. **Gestion des Tokens**
   - Stockage sécurisé dans localStorage
   - Envoi dans header `Authorization: Bearer <token>`
   - Suppression à la déconnexion

## 📦 Installation

### Prérequis
- Node.js (version 14 ou supérieure)
- npm ou yarn

### Étapes

1. **Naviguer dans le dossier du serveur**
   ```bash
   cd "exercice-8-Mettre en œuvre des règles de sécurité basiques/server"
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Démarrer le serveur**
   ```bash
   npm start
   ```
   
   Ou en mode développement avec auto-restart :
   ```bash
   npm run dev
   ```

4. **Accéder à l'application**
   - Ouvrir votre navigateur à l'adresse : `http://localhost:3000`

## 🚀 Utilisation

### 1. Inscription

1. Sur la page d'accueil, cliquer sur "S'inscrire"
2. Choisir un nom d'utilisateur (minimum 3 caractères)
3. Choisir un mot de passe (minimum 6 caractères)
4. Confirmer le mot de passe
5. Cliquer sur "S'inscrire"

### 2. Connexion

1. Entrer votre nom d'utilisateur
2. Entrer votre mot de passe
3. Cliquer sur "Se connecter"

### 3. Créer une Note

1. Une fois connecté, entrer le texte de votre note dans la zone de texte
2. Cliquer sur "➕ Ajouter la note"
3. La note apparaît instantanément pour tous les utilisateurs connectés

### 4. Modifier une Note

1. Cliquer sur l'icône ✏️ sur votre note
2. Modifier le contenu dans le modal
3. Cliquer sur "💾 Sauvegarder"

⚠️ **Note** : Vous ne pouvez modifier que vos propres notes.

### 5. Supprimer une Note

1. Cliquer sur l'icône 🗑️ sur votre note
2. Confirmer la suppression dans le modal
3. La note est supprimée pour tous les utilisateurs

⚠️ **Note** : Vous ne pouvez supprimer que vos propres notes.

### 6. Filtrer les Notes

Utilisez les boutons de filtre pour afficher :
- **Toutes** : Toutes les notes
- **Mes notes** : Uniquement vos notes
- **Autres** : Notes des autres utilisateurs

## 🔧 Configuration

### Variables d'Environnement

Vous pouvez personnaliser la configuration via des variables d'environnement :

```bash
PORT=3000                          # Port du serveur (défaut: 3000)
JWT_SECRET=votre_secret_unique     # Secret pour signer les JWT
```

### Modifier le Secret JWT

⚠️ **IMPORTANT** : Changez le secret JWT en production !

Dans `server/index.js`, ligne 26 :
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise_changez_moi_en_production';
```

## 📚 API Reference

### Authentification

#### POST /register
Inscription d'un nouvel utilisateur.

**Body:**
```json
{
  "username": "string (min 3 caractères)",
  "password": "string (min 6 caractères)"
}
```

**Réponse (201):**
```json
{
  "message": "Utilisateur créé avec succès",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "username": "john",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /login
Connexion d'un utilisateur existant.

**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Réponse (200):**
```json
{
  "message": "Connexion réussie",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "username": "john",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Notes

#### GET /notes
Récupère toutes les notes (lecture publique).

**Réponse (200):**
```json
[
  {
    "id": 1,
    "content": "Ma première note",
    "authorId": 1,
    "authorUsername": "john",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /notes
Crée une nouvelle note (authentification requise).

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "content": "string (max 1000 caractères)"
}
```

**Réponse (201):**
```json
{
  "id": 1,
  "content": "Ma première note",
  "authorId": 1,
  "authorUsername": "john",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### PUT /notes/:id
Modifie une note existante (authentification requise + propriété vérifiée).

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "content": "string (max 1000 caractères)"
}
```

**Réponse (200):**
```json
{
  "id": 1,
  "content": "Note modifiée",
  "authorId": 1,
  "authorUsername": "john",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T10:00:00.000Z"
}
```

**Erreurs:**
- 403 : "Vous ne pouvez modifier que vos propres notes"
- 404 : "Note non trouvée"

#### DELETE /notes/:id
Supprime une note (authentification requise + propriété vérifiée).

**Headers:**
```
Authorization: Bearer <token>
```

**Réponse (200):**
```json
{
  "message": "Note supprimée avec succès",
  "deletedNote": { ... }
}
```

**Erreurs:**
- 403 : "Vous ne pouvez supprimer que vos propres notes"
- 404 : "Note non trouvée"

## 🔌 Socket.IO Events

### Client → Serveur

#### request_notes
Demande la liste complète des notes.

### Serveur → Client

#### notes_updated
Diffusé à tous les clients lors de toute modification des notes.

**Data:**
```json
[
  { "id": 1, "content": "...", ... }
]
```

#### connect / disconnect
Événements standard de Socket.IO pour gérer la connexion.

## 🧪 Tests Manuels

### Test 1 : Inscription
1. Créer un utilisateur "alice" avec mot de passe "password123"
2. Vérifier la redirection vers l'application
3. Vérifier que le token est stocké dans localStorage

### Test 2 : Connexion
1. Se déconnecter
2. Se reconnecter avec "alice" / "password123"
3. Vérifier l'accès au tableau de bord

### Test 3 : Création de Note
1. Connecté en tant qu'Alice, créer une note "Note d'Alice"
2. Ouvrir un autre navigateur/onglet privé
3. Créer un utilisateur "bob" et se connecter
4. Vérifier que la note d'Alice est visible pour Bob

### Test 4 : Autorisation de Modification
1. En tant que Bob, essayer de modifier la note d'Alice
2. Vérifier qu'il n'y a pas de boutons ✏️ et 🗑️ sur la note d'Alice

### Test 5 : Temps Réel
1. Garder deux navigateurs ouverts (Alice et Bob)
2. Alice crée une note
3. Vérifier qu'elle apparaît instantanément chez Bob
4. Alice modifie sa note
5. Vérifier la mise à jour en temps réel chez Bob

### Test 6 : Persistance
1. Créer quelques notes
2. Arrêter le serveur (Ctrl+C)
3. Redémarrer le serveur
4. Vérifier que les utilisateurs et notes sont toujours présents

## 🛠️ Technologies Utilisées

- **Backend**
  - Node.js
  - Express.js
  - Socket.IO (WebSockets)
  - bcrypt (hashage de mots de passe)
  - jsonwebtoken (JWT)
  - cors (CORS middleware)

- **Frontend**
  - HTML5
  - CSS3 (design moderne et responsive)
  - JavaScript ES6+
  - Socket.IO Client

## 📖 Concepts Clés

### 1. Authentification JWT
Les JSON Web Tokens permettent une authentification stateless. Le serveur génère un token signé contenant les informations utilisateur, que le client envoie avec chaque requête.

### 2. Autorisation par Propriété
Chaque note contient un `authorId`. Avant toute modification/suppression, le serveur vérifie que `req.user.userId === note.authorId`.

### 3. WebSockets Sécurisés
Socket.IO vérifie le JWT lors de la connexion. Seuls les utilisateurs authentifiés peuvent se connecter au WebSocket.

### 4. Persistance JSON
Les données sont sauvegardées dans des fichiers JSON après chaque modification, permettant la persistance entre les redémarrages.

## ⚠️ Limitations & Améliorations Possibles

### Limitations Actuelles
- Stockage en mémoire avec persistance JSON (pas de base de données)
- Pas de gestion de sessions avancée
- Secret JWT codé en dur (à externaliser en production)
- Pas de rate limiting
- Pas de validation par email

### Améliorations Possibles
- Ajouter une vraie base de données (MongoDB, PostgreSQL)
- Implémenter le refresh token
- Ajouter le rate limiting pour prévenir les attaques
- Validation par email
- Rôles et permissions avancés
- Historique des modifications
- Pièces jointes aux notes
- Catégories/tags pour les notes
- Recherche et filtrage avancé

## 📝 Notes de Développement

### Structure du Code Serveur
- **Lignes 1-35** : Configuration et imports
- **Lignes 36-106** : Fonctions de persistance JSON
- **Lignes 107-136** : Middleware d'authentification
- **Lignes 137-245** : Routes d'authentification (/register, /login)
- **Lignes 246-368** : Routes API des notes (GET, POST, PUT, DELETE)
- **Lignes 369-407** : Configuration Socket.IO
- **Lignes 408-445** : Démarrage et arrêt du serveur

### Structure du Code Client
- **Variables globales** : État de l'application
- **Initialisation** : Vérification auth, chargement notes, connexion Socket.IO
- **Gestion événements** : Formulaires, boutons, modals
- **API Calls** : CRUD des notes avec fetch()
- **Socket.IO** : Écoute des mises à jour en temps réel
- **Rendering** : Affichage dynamique des notes et stats
- **Utilitaires** : Formatage dates, échappement HTML

## 🤝 Contribution

Ce projet est un exercice pédagogique. N'hésitez pas à l'améliorer et à l'adapter à vos besoins !

## 📄 Licence

MIT - Libre d'utilisation à des fins éducatives.

---

**Développé dans le cadre du cours sur les Applications Temps Réel**


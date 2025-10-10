# 🎮 Éditeur Collaboratif Temps Réel - Style Call of Duty

## Description

Application d'éditeur de texte collaboratif en temps réel utilisant Socket.IO avec Redis Adapter pour la scalabilité multi-instances. Interface inspirée de **Call of Duty: Modern Warfare 3** avec design militaire futuriste, effets néon et animations fluides. Les utilisateurs peuvent écrire ensemble dans un espace de travail partagé avec synchronisation instantanée des modifications.

## Fonctionnalités

### ✅ Fonctionnalités principales

- **🎮 Interface Call of Duty** : Design militaire futuriste avec effets néon
- **Éditeur collaboratif** : `<textarea>` synchronisé en temps réel
- **Authentification par token** : Clé partagée simple pour rejoindre
- **Rooms (espaces de travail)** : Isolation des groupes d'utilisateurs
- **Synchronisation multi-instances** : Redis Adapter pour scalabilité
- **Monitoring temps réel** : Interface de surveillance avec graphiques
- **🔒 Sécurité renforcée** : Rate limiting, validation stricte, détection d'abus
- **Curseurs distants** : Visualisation des positions des autres utilisateurs

### 🔧 Fonctionnalités techniques

- **Socket.IO** : Communication WebSocket bidirectionnelle
- **Redis Pub/Sub** : Synchronisation entre instances serveur
- **Validation stricte** : `validator.js` (serveur) + `DOMPurify` (client)
- **Rate limiting** : `express-rate-limit` + logique custom Socket.IO
- **Détection d'abus** : Déconnexion automatique des clients malveillants
- **Calcul de deltas** : Optimisation de la bande passante
- **Gestion des conflits** : Évite les boucles infinies
- **Architecture modulaire** : Séparation serveur/client

## 🎮 Design Call of Duty

### Thème visuel

L'interface est inspirée de **Call of Duty: Modern Warfare 3** avec :

- **Palette de couleurs** : Bleu cyan (#00d4ff), Orange (#ff6b00), Or (#ffd700)
- **Fond sombre** : Dégradés noirs avec particules animées
- **Polices** : Orbitron (titres) + Rajdhani (texte) pour un look militaire
- **Effets néon** : Ombres lumineuses, bordures brillantes, animations
- **Particules** : Arrière-plan animé avec points lumineux
- **Animations** : Effets de scan, pulsations, survols avec lueur

### Éléments visuels

- **Bordures carrées** : Style militaire sans coins arrondis
- **Gradients** : Dégradés sombres avec transparence
- **Backdrop blur** : Effet de flou d'arrière-plan
- **Box shadows** : Ombres colorées avec lueur
- **Hover effects** : Animations de survol avec balayage lumineux

## Architecture du projet

```
exercice-7/
├── client/
│   ├── index.html            # Interface principale
│   ├── script.js             # Logique client Socket.IO
│   ├── style.css             # Styles Call of Duty
│   └── monitor.html          # Page de monitoring
├── server/
│   ├── index.js              # Serveur Express + Socket.IO
│   └── package.json          # Dépendances serveur
├── README.md                 # Documentation
├── SECURITY.md               # Documentation sécurité
└── start.sh                  # Script de démarrage
```

## Prérequis

- **Node.js** (version 16 ou supérieure)
- **npm** (généralement inclus avec Node.js)
- **Redis** (pour la synchronisation multi-instances)
- **Docker** (optionnel, pour Redis)

## Installation et Exécution

### Méthode 1 : Installation manuelle

```bash
# 1. Installer les dépendances du serveur
cd server
npm install

# 2. Démarrer Redis (si non installé)
# Option A : Avec Docker
docker run -d -p 6379:6379 redis:alpine

# Option B : Installation locale
# Suivre les instructions sur https://redis.io/download

# 3. Démarrer le serveur
npm start
```

### Méthode 2 : Script automatique

```bash
# Rendre le script exécutable
chmod +x start.sh

# Démarrer l'application
./start.sh
```

## Utilisation

### 1. Accès à l'application

- **Interface principale** : `http://localhost:3000/client/index.html`
- **Monitoring** : `http://localhost:3000/monitor`

### 2. Connexion

1. **Pseudonyme** : Entrez votre nom (2-20 caractères)
2. **Token** : Utilisez le token par défaut `secret123`
3. **Room** : Sélectionnez un espace de travail
4. **Connexion** : Cliquez sur "Rejoindre"

### 3. Édition collaborative

- **Écriture** : Tapez dans l'éditeur, les modifications sont synchronisées instantanément
- **Curseurs** : Voir les positions des autres utilisateurs en temps réel
- **Notifications** : Arrivées/départs d'utilisateurs
- **Statistiques** : Compteur de caractères et utilisateurs actifs

### 4. Monitoring

- **Statistiques en direct** : Connexions, utilisateurs, événements/minute
- **Rooms actives** : Liste des espaces de travail avec détails
- **Graphique d'activité** : Visualisation de l'activité en temps réel
- **Mise à jour automatique** : Toutes les 2 secondes

## Configuration

### Variables d'environnement

```bash
# Port du serveur (défaut: 3000)
PORT=3000

# URL Redis (défaut: redis://localhost:6379)
REDIS_URL=redis://localhost:6379

# Token d'authentification (défaut: secret123)
EDITOR_TOKEN=secret123
```

### Rooms disponibles

- **general** : Discussion générale
- **tech** : Discussions techniques
- **projet** : Espace projet
- **notes** : Prise de notes

## Événements Socket.IO

### Côté client → serveur

- `user_connected` : Connexion d'un utilisateur
- `editor_update` : Mise à jour de l'éditeur (delta)
- `cursor_position` : Position du curseur
- `editor_sync_request` : Demande de synchronisation

### Côté serveur → client

- `user_connected_success` : Confirmation de connexion
- `notification` : Arrivée/départ d'utilisateur
- `users_list` : Liste des utilisateurs connectés
- `editor_update` : Mise à jour de l'éditeur
- `cursor_position` : Position du curseur distant
- `editor_sync` : Synchronisation complète
- `error` : Erreur de validation/connexion

## Sécurité

### Authentification

- **Token simple** : Clé partagée dans l'URL (`?token=secret123`)
- **Middleware Socket.IO** : Vérification avant connexion
- **Validation stricte** : Rejet des connexions sans token valide

### Validation et sanitisation

- **Serveur** : `validator.js` pour échapper les données
- **Client** : `DOMPurify` pour nettoyer le HTML
- **Limites** : Pseudonyme (20 chars), éditeur (50000 chars)
- **Types** : Validation des types et formats de données

## Monitoring

### Métriques disponibles

- **Connexions actives** : Nombre de WebSocket connectés
- **Utilisateurs totaux** : Nombre d'utilisateurs dans toutes les rooms
- **Événements/minute** : Activité moyenne du serveur
- **Uptime** : Temps de fonctionnement
- **Rooms actives** : Détails par room (utilisateurs, événements)

### API de monitoring

```bash
# Endpoint JSON
GET http://localhost:3000/status

# Réponse
{
  "status": "online",
  "uptime": 3600,
  "totalConnections": 5,
  "totalUsers": 3,
  "eventsPerMinute": 45,
  "totalEvents": 2700,
  "rooms": [
    {
      "name": "general",
      "users": 2,
      "events": 150
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Dépannage

### Problèmes courants

#### Le serveur ne démarre pas

```bash
# Vérifier Node.js
node --version

# Vérifier le port
lsof -i :3000

# Installer les dépendances
cd server && npm install
```

#### Erreur Redis

```bash
# Vérifier Redis
redis-cli ping

# Démarrer Redis avec Docker
docker run -d -p 6379:6379 redis:alpine

# L'application fonctionne sans Redis (mode local uniquement)
```

#### Problèmes de connexion

- Vérifier que le serveur est démarré
- Vérifier l'URL : `http://localhost:3000`
- Vérifier le token : `secret123`
- Consulter la console du navigateur

#### Interface ne s'affiche pas

- Vérifier que tous les fichiers sont présents
- Actualiser la page
- Vérifier la console du navigateur

### Logs et débogage

```bash
# Logs du serveur
npm start

# Mode développement avec logs détaillés
NODE_ENV=development npm start
```

## Développement

### Structure du code

#### Serveur (`server/index.js`)

- **Express** : Serveur HTTP
- **Socket.IO** : WebSocket avec Redis Adapter
- **Middleware** : Authentification par token
- **Validation** : `validator.js` pour les données
- **Monitoring** : Route `/status` et `/monitor`

#### Client (`client/`)

- **HTML** : Interface utilisateur responsive
- **CSS** : Design moderne avec animations
- **JavaScript** : Logique Socket.IO et synchronisation
- **DOMPurify** : Sanitisation côté client

### Extensions possibles

- **Tableau blanc** : Canvas HTML5 pour le dessin
- **Chat intégré** : Messages texte dans l'interface
- **Historique** : Sauvegarde des modifications
- **Permissions** : Rôles utilisateur (lecture/écriture)
- **Thèmes** : Mode sombre/clair
- **Export** : Sauvegarde en PDF/Word

## Technologies utilisées

- **Backend** : Node.js, Express, Socket.IO, Redis, validator.js, express-rate-limit, helmet
- **Frontend** : HTML5, CSS3, JavaScript ES6+, DOMPurify, Chart.js, Orbitron/Rajdhani fonts
- **Base de données** : Redis (Pub/Sub)
- **Validation** : validator.js, DOMPurify
- **Sécurité** : Rate limiting, validation stricte, détection d'abus, sanitisation
- **Design** : Thème Call of Duty avec effets néon, animations, particules
- **Monitoring** : Chart.js
- **Architecture** : Microservices avec Redis Adapter

## Licence

Ce projet est un exercice pédagogique pour l'apprentissage des technologies temps réel.

## Support

Pour toute question ou problème :

1. Consulter la section Dépannage
2. Vérifier les logs du serveur
3. Consulter la console du navigateur
4. Vérifier la configuration Redis

# Chat en Temps Réel - Exercice 4

## Description
Application de chat en temps réel utilisant Socket.IO avec gestion des utilisateurs connectés et interface moderne.

## Fonctionnalités
- ✅ Connexion avec pseudonyme et sélection de room
- ✅ Chat en temps réel avec isolation par room
- ✅ Liste des utilisateurs connectés en temps réel
- ✅ Notifications d'arrivée/départ des utilisateurs
- ✅ **Changement de room en temps réel** avec la commande `/room <nom>`
- ✅ Interface responsive et moderne
- ✅ Validation des pseudonymes
- ✅ Couleurs uniques pour chaque utilisateur

## Prérequis
- Node.js (version 14 ou supérieure)
- npm (généralement inclus avec Node.js)

## Installation et Exécution

### Méthode 1 : Script automatique (Recommandé)
```bash
# Démarrer le serveur
./start-server.sh

# Arrêter le serveur
./stop-server.sh
```

### Méthode 2 : Installation manuelle
```bash
# Installer les dépendances
npm install

# Démarrer le serveur
npm start
# ou
node server.js
```

## Utilisation

1. **Démarrer le serveur** : Exécutez le script `start-server.sh` ou `node server.js`
2. **Ouvrir l'application** : 
   - Ouvrez votre navigateur
   - Allez sur `http://localhost:3000` 
   - OU ouvrez directement le fichier `client.html` dans votre navigateur
3. **Se connecter** : 
   - Entrez votre pseudonyme (minimum 2 caractères, maximum 20)
   - Cliquez sur "Se connecter"
4. **Chatter** : 
   - Tapez vos messages dans le champ de saisie
   - Appuyez sur "Envoyer" ou la touche Entrée
   - Consultez la liste des utilisateurs connectés à droite
5. **Changer de room** :
   - Tapez `/room <nom>` (ex: `/room tech`) pour changer de room
   - Les rooms disponibles sont : `general`, `tech`
   - Vous recevrez une confirmation du changement

## Structure des fichiers
```
exercice-4/
├── server.js          # Serveur Socket.IO
├── client.html        # Interface utilisateur
├── scriptClient.js    # Logique côté client
├── style.css          # Styles CSS
├── package.json       # Dépendances Node.js
├── start-server.sh    # Script de démarrage
└── README.md          # Ce fichier
```

## Ports utilisés
- **Serveur** : Port 3000
- **Client** : Se connecte automatiquement au serveur

## Arrêt du serveur
- **Script automatique** : `./stop-server.sh`
- **Manuel** : Appuyez sur `Ctrl+C` dans le terminal où il s'exécute

## Dépannage

### Le serveur ne démarre pas
- Vérifiez que Node.js est installé : `node --version`
- Vérifiez que le port 3000 n'est pas utilisé : `lsof -i :3000`
- Arrêtez les processus existants : `./stop-server.sh`
- Installez les dépendances : `npm install`

### Erreur "EADDRINUSE" (port déjà utilisé)
- Utilisez le script d'arrêt : `./stop-server.sh`
- Ou arrêtez manuellement : `pkill -f "node server.js"`
- Le script de démarrage gère automatiquement ce cas

### Problèmes de connexion
- Vérifiez que le serveur est bien démarré
- Assurez-vous d'utiliser la bonne URL : `http://localhost:3000`
- Vérifiez la console du navigateur pour les erreurs

### Interface ne s'affiche pas correctement
- Vérifiez que le fichier `style.css` est présent
- Actualisez la page du navigateur
- Vérifiez que tous les fichiers sont dans le même dossier

## Commandes disponibles
- `/room <nom>` - Changer de room (ex: `/room tech`, `/room general`)

## Rooms disponibles
- **general** - Discussion générale
- **tech** - Discussions techniques

## Technologies utilisées
- **Backend** : Node.js, Socket.IO
- **Frontend** : HTML5, CSS3, JavaScript (ES6+)
- **Communication** : WebSockets via Socket.IO
- **Gestion des rooms** : Socket.IO rooms avec isolation automatique

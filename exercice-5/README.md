# Chat en Temps Réel avec Redis Pub/Sub - Exercice 5

## Description
Application de chat en temps réel utilisant Socket.IO avec **Redis Pub/Sub pour la scalabilité multi-instances**. Cette implémentation permet de faire fonctionner plusieurs instances de serveur tout en maintenant la cohérence des communications grâce à Redis.

## Fonctionnalités
- ✅ Connexion avec pseudonyme et sélection de room
- ✅ Chat en temps réel avec isolation par room
- ✅ Liste des utilisateurs connectés en temps réel
- ✅ Notifications d'arrivée/départ des utilisateurs
- ✅ **Changement de room en temps réel** avec la commande `/room <nom>`
- ✅ Interface responsive et moderne
- ✅ Validation des pseudonymes
- ✅ Couleurs uniques pour chaque utilisateur
- ✅ **Redis Pub/Sub pour scalabilité multi-instances**
- ✅ Synchronisation des messages entre toutes les instances serveur
- ✅ Messages privés synchronisés entre instances
- ✅ Gestion automatique des déconnexions et reconnexions

## Prérequis
- Node.js (version 14 ou supérieure)
- npm (généralement inclus avec Node.js)
- **Docker** (pour Redis Pub/Sub)

## Installation et Exécution

### Méthode 1 : Script automatique avec Redis (Recommandé)
```bash
# Démarrer une instance simple avec Redis Pub/Sub
./start-server.sh

# Arrêter le serveur
./stop-server.sh
```

**⚠️ Important :** Cette méthode nécessite que Docker soit installé et en cours d'exécution.

### Méthode 1b : Script alternatif sans Redis (Pour tester l'interface)
```bash
# Démarrer sans Redis (messages locaux uniquement)
./start-server-no-redis.sh

# Arrêter le serveur avec Ctrl+C
```

### Méthode 2 : Test multi-instances (Pour tester Redis Pub/Sub)
```bash
# Démarrer automatiquement 3 instances pour tester la scalabilité
./test-multi-instances.sh

# Arrêter toutes les instances avec Ctrl+C
```

### Méthode 3 : Démonstration guidée (Recommandé pour débuter)
```bash
# Démarrage automatique de Redis + 2 instances avec instructions
./demo.sh

# Arrêter la démonstration avec Ctrl+C
```

### Méthode 4 : Installation manuelle
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
exercice-5/
├── server.js                   # Serveur Socket.IO avec Redis Pub/Sub
├── client.html                 # Interface utilisateur
├── scriptClient.js             # Logique côté client
├── style.css                   # Styles CSS
├── package.json                # Dépendances Node.js
├── start-server.sh             # Script de démarrage avec Redis
├── start-server-no-redis.sh    # Script alternatif sans Redis
├── test-multi-instances.sh     # Script de test multi-instances
├── demo.sh                     # Démonstration guidée
├── validate-implementation.js  # Validation de l'implémentation
├── stop-server.sh              # Script d'arrêt
├── README.md                   # Ce fichier
└── BONNES_PRATIQUES_SOCKETIO.md # Bonnes pratiques Socket.IO
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

### Problèmes avec Docker/Redis
- **"Cannot connect to the Docker daemon"** : Démarrez Docker Desktop
- **Redis ne démarre pas** : Vérifiez que Docker Desktop est bien lancé
- **Solution alternative** : Utilisez `./start-server-no-redis.sh` pour tester sans Redis
- **Installation Docker** : Téléchargez depuis https://docs.docker.com/get-docker/

## Commandes disponibles
- `/room <nom>` - Changer de room (ex: `/room tech`, `/room general`)

## Rooms disponibles
- **general** - Discussion générale
- **tech** - Discussions techniques

## Architecture Redis Pub/Sub

### Principe de fonctionnement
Redis Pub/Sub permet à plusieurs instances de serveur de communiquer entre elles :

1. **Publication** : Lorsqu'un message est reçu par une instance, elle le publie sur un canal Redis (`chat_messages`)
2. **Souscription** : Toutes les instances s'abonnent au même canal et reçoivent tous les messages
3. **Diffusion locale** : Chaque instance diffuse le message à ses clients WebSocket locaux

### Avantages
- **Haute disponibilité** : Si une instance tombe, les autres continuent de fonctionner
- **Scalabilité horizontale** : Possibilité d'ajouter des instances pour supporter plus d'utilisateurs
- **Cohérence** : Tous les messages sont synchronisés entre toutes les instances
- **Isolation** : Évite les boucles infinies grâce aux IDs d'instance uniques

### Test multi-instances
Pour tester la scalabilité :

```bash
# Terminal 1 - Instance principale (port 3000)
./start-server.sh

# Terminal 2 - Instance secondaire (port 3001)
node server.js 3001

# Terminal 3 - Instance tertiaire (port 3002)
node server.js 3002
```

Ouvrez ensuite plusieurs onglets navigateur :
- `http://localhost:3000` (instance 1)
- `http://localhost:3001` (instance 2)
- `http://localhost:3002` (instance 3)

Tous les messages envoyés depuis n'importe quelle instance seront visibles dans toutes les autres instances.

## Technologies utilisées
- **Backend** : Node.js, Socket.IO
- **Frontend** : HTML5, CSS3, JavaScript (ES6+)
- **Communication** : WebSockets via Socket.IO
- **Pub/Sub** : Redis avec ioredis
- **Conteneurisation** : Docker pour Redis
- **Gestion des rooms** : Socket.IO rooms avec isolation automatique

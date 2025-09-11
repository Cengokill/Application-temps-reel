# 📈 Application Cotations Boursières Temps Réel

Une application complète pour la simulation et la visualisation de cotations boursières en temps réel utilisant Server-Sent Events (SSE).

## 🏗️ Architecture

L'application est composée de deux parties principales :

### Serveur (Node.js + Express)
- **Dossier**: `server/`
- Génère des cotations fictives pour 5 actions
- Diffuse les données via SSE
- Fournit une interface web simple

### Client (Angular 20 - optionnel)
- **Dossier**: `client/`
- Interface moderne avec signaux Angular
- Visualisation avancée des données

## 🚀 Démarrage Rapide

### Option 1: Interface Web Simple (Recommandé)
```bash
# Depuis la racine du projet
./start-server.sh
# ou
cd server && npm run open
```

### Option 2: Serveur seulement
```bash
cd server
npm install
npm start
```
Puis ouvrez http://localhost:3000 dans votre navigateur

## 📊 Fonctionnalités

### Serveur SSE
- ✅ Génération automatique de cotations fictives
- ✅ Diffusion en temps réel via Server-Sent Events
- ✅ Mise à jour toutes les 2 secondes
- ✅ 5 actions simulées : AAPL, GOOGL, MSFT, TSLA, AMZN
- ✅ Interface web responsive et moderne

### Client Angular (À venir)
- ✅ Utilisation des signaux Angular
- ✅ Application zoneless
- ✅ Interface moderne et réactive

## 🛠️ Technologies Utilisées

- **Backend**: Node.js, Express.js
- **Temps réel**: Server-Sent Events (SSE)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (interface simple)
- **Client Angular**: Angular 20, Signaux, TypeScript

## 📁 Structure du Projet

```
exercice-1/
├── server/                 # Serveur Node.js SSE
│   ├── index.js           # Serveur principal
│   ├── package.json       # Dépendances
│   ├── public/            # Fichiers statiques
│   │   └── index.html     # Interface web
│   └── README.md          # Documentation serveur
├── client/                # Client Angular (à créer)
├── start-server.sh        # Script de démarrage rapide
└── README.md             # Cette documentation
```

## 🔧 Installation Détaillée

### Serveur
```bash
cd server
npm install
npm start
```

### Client Angular (À venir)
```bash
cd client
npm install
ng serve
```

## 🌐 Utilisation

1. **Démarrer le serveur** avec `./start-server.sh`
2. **Ouvrir** http://localhost:3000 dans votre navigateur
3. **Observer** les cotations qui se mettent à jour automatiquement
4. **Profiter** de l'interface responsive et moderne

## 📈 Actions Simulées

- **AAPL**: Apple Inc.
- **GOOGL**: Alphabet Inc.
- **MSFT**: Microsoft Corporation
- **TSLA**: Tesla Inc.
- **AMZN**: Amazon.com Inc.

Chaque action a un prix de base réaliste et varie de ±5% à chaque mise à jour.

## 🔄 Flux de Données

```
Serveur Node.js → SSE → Navigateur → Interface HTML/CSS/JS
     ↑                                ↓
Génération aléatoire          Mise à jour temps réel
(toutes les 2s)                (interface utilisateur)
```

## 🚨 Dépannage

### Le serveur ne démarre pas
- Vérifiez que le port 3000 n'est pas utilisé
- Assurez-vous que Node.js est installé
- Lancez `npm install` dans le dossier server

### L'interface ne se met pas à jour
- Vérifiez la connexion réseau
- Ouvrez les outils de développement (F12) pour voir les erreurs
- Le serveur se reconnecte automatiquement en cas de problème

### Erreur CORS
- Le serveur est configuré pour accepter toutes les origines
- Si vous utilisez un domaine personnalisé, ajustez la configuration CORS

## 📝 Notes de Développement

- Le serveur génère des données fictives pour la démonstration
- Les prix sont basés sur des valeurs réalistes mais aléatoirement modifiés
- L'interface utilise CSS moderne avec des animations fluides
- La connexion SSE se reconnecte automatiquement en cas de déconnexion

---

**🎯 Prêt à trader ?** Lancez `./start-server.sh` et observez les marchés !

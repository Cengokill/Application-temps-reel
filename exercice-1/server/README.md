# Serveur SSE - Cotations Boursières

Serveur Node.js utilisant Express et Server-Sent Events (SSE) pour diffuser des cotations boursières fictives en temps réel.

## Fonctionnalités

- Génération automatique de cotations pour 5 actions fictives : AAPL, GOOGL, MSFT, TSLA, AMZN
- Diffusion en temps réel via Server-Sent Events
- Mise à jour des prix toutes les 2 secondes
- API REST simple pour vérifier le statut du serveur

## Installation

```bash
cd server
npm install
```

## Démarrage

### Démarrage simple (recommandé)
```bash
npm run open
```
Cette commande démarre le serveur et ouvre automatiquement votre navigateur à http://localhost:3000

### Démarrage manuel
```bash
npm start
```
Le serveur sera accessible sur http://localhost:3000

## Interface Web Simple

Une interface HTML simple est disponible pour tester le serveur SSE :

**http://localhost:3000/** - Interface de visualisation des cotations en temps réel

Cette interface :
- Se connecte automatiquement au flux SSE
- Affiche les cotations de 5 actions fictives
- Met à jour les prix en temps réel toutes les 2 secondes
- Indique le statut de la connexion
- Se reconnecte automatiquement en cas de déconnexion

## Endpoints

### GET /
Retourne les informations du serveur

### GET /api/stocks/sse
Endpoint SSE pour recevoir les cotations en temps réel

## Format des données SSE

```javascript
[
  {
    "symbol": "AAPL",
    "price": 152.34,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "change": 1.23
  },
  // ... autres actions
]
```

## Utilisation avec un client

Pour vous connecter au flux SSE depuis un navigateur :

```javascript
const eventSource = new EventSource('http://localhost:3000/api/stocks/sse');

eventSource.onmessage = (event) => {
  const stocks = JSON.parse(event.data);
  console.log('Nouvelles cotations:', stocks);
};
```

# Système de Mise à Jour du Statut d'une Tâche

Ce projet implémente un système de suivi du statut d'une tâche utilisant la technique du Long Polling pour les mises à jour en temps réel.

## Architecture

### Backend (Node.js + Express)
- **Gestion d'état** : Maintient le statut actuel d'une tâche en mémoire
- **Versioning** : Utilise un numéro de version pour détecter les changements
- **Long Polling** : Endpoint `/poll-status` pour recevoir les mises à jour en temps réel
- **API Admin** : Endpoint `/update-status` pour modifier manuellement le statut

### Frontend
- **Affichage temps réel** : Interface moderne pour visualiser le statut
- **Long Polling client** : Reconnexion automatique après chaque mise à jour
- **Panneau d'administration** : Interface pour changer manuellement le statut

## Installation et Démarrage

1. **Installer les dépendances** :
   ```bash
   npm install
   ```

2. **Démarrer le serveur** :
   ```bash
   npm start
   ```

3. **Accéder à l'application** :
   Ouvrez votre navigateur et allez sur `http://localhost:3000`

## API Endpoints

### GET /get-status
Retourne le statut actuel et sa version.
```json
{
  "status": "En attente",
  "version": 0
}
```

### POST /update-status
Met à jour le statut de la tâche.
**Body** :
```json
{
  "status": "En cours"
}
```
**Réponse** :
```json
{
  "message": "Statut mis à jour avec succès",
  "status": "En cours",
  "version": 1
}
```

### GET /poll-status?last_version=X
Endpoint Long Polling qui attend les changements de statut.
- Si `last_version < current_version` : retourne immédiatement le nouveau statut
- Sinon : maintient la connexion ouverte pendant 25 secondes maximum

## Fonctionnement du Long Polling

1. **Client** : Envoie une requête GET à `/poll-status` avec sa `last_version`
2. **Serveur** :
   - Si version différente : répond immédiatement avec le nouveau statut
   - Sinon : garde la connexion ouverte et ajoute la requête à la liste d'attente
3. **Lors d'une mise à jour** : Le serveur notifie toutes les connexions en attente
4. **Timeout** : Après 25 secondes, le serveur ferme la connexion si aucun changement

## Statuts Disponibles

- **En attente** : État initial
- **En cours** : Tâche en cours d'exécution
- **Terminée** : Tâche terminée avec succès
- **Échec** : Tâche terminée avec erreur

## Technologies Utilisées

- **Backend** : Node.js, Express.js
- **Frontend** : HTML5, CSS3, JavaScript (ES6+)
- **Communication** : HTTP Long Polling
- **Style** : Interface moderne avec dégradés et animations

## Fonctionnalités

- ✅ Mise à jour temps réel du statut via Long Polling
- ✅ Interface d'administration pour changement manuel
- ✅ Logs d'activité en temps réel
- ✅ Gestion d'erreurs et reconnexion automatique
- ✅ Interface responsive
- ✅ Indicateur de statut de connexion

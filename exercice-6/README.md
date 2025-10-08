# Tableau de Bord Collaboratif

Une application web collaborative de type "Post-it" virtuel permettant à plusieurs utilisateurs d'ajouter, modifier et supprimer des notes en temps réel.

## Fonctionnalités

- **Authentification sécurisée** : Système de connexion/inscription avec JWT
- **Ajout de notes** : Créez de nouvelles notes avec du texte (utilisateurs connectés uniquement)
- **Modification en temps réel** : Éditez le contenu des notes existantes (propriétaire uniquement)
- **Suppression de notes** : Supprimez les notes dont vous n'avez plus besoin (propriétaire uniquement)
- **Synchronisation temps réel** : Toutes les modifications sont automatiquement synchronisées entre tous les utilisateurs connectés
- **Interface moderne** : Design responsive et intuitif avec modales d'authentification

## Architecture

### Backend (Node.js + Express.js)
- **Serveur HTTP** : Express.js pour servir l'interface et l'API REST
- **WebSockets** : Socket.IO pour la communication temps réel avec authentification JWT
- **Stockage** : Notes en mémoire, utilisateurs persistés dans `users.json`
- **API REST** :
  - `POST /register` : Inscription d'un nouvel utilisateur
  - `POST /login` : Connexion d'un utilisateur
  - `GET /notes` : Récupère toutes les notes (lecture publique)
  - `POST /notes` : Crée une nouvelle note (authentification requise)
  - `PUT /notes/:id` : Met à jour une note existante (propriétaire uniquement)
  - `DELETE /notes/:id` : Supprime une note (propriétaire uniquement)
- **Événements Socket.IO sécurisés** (optionnels) :
  - `edit_note` : Modification directe d'une note (authentifié + propriétaire)
  - `delete_note` : Suppression directe d'une note (authentifié + propriétaire)

### Frontend (HTML/CSS/JavaScript)
- **Interface utilisateur** : HTML5 sémantique avec CSS3 moderne
- **JavaScript vanilla** : Gestion des interactions sans framework
- **Socket.IO client** : Connexion temps réel avec le serveur
- **Design responsive** : Adapté aux mobiles et desktops

## Structure du Projet

```
exercice-6/
├── server.js          # Serveur principal (Express + Socket.IO)
├── package.json       # Dépendances et configuration Node.js
├── public/            # Fichiers statiques frontend
│   ├── index.html     # Interface principale
│   ├── style.css      # Styles CSS
│   └── app.js         # Logique JavaScript frontend
└── README.md          # Documentation
```

## Installation et Démarrage

### Prérequis
- Node.js (version 14 ou supérieure)
- npm (inclus avec Node.js)

### Installation
```bash
# Naviguer vers le répertoire du projet
cd exercice-6

# Installer les dépendances
npm install
```

### Démarrage
```bash
# Démarrer le serveur
npm start
# ou
node server.js
```

Le serveur sera accessible à l'adresse : `http://localhost:3000`

## Utilisation

1. **Ajouter une note** :
   - Saisissez votre texte dans la zone de texte en haut
   - Cliquez sur "Ajouter une note" ou appuyez sur Entrée

2. **Modifier une note** :
   - Cliquez sur le bouton "Modifier" d'une note
   - Modifiez le contenu dans le formulaire d'édition
   - Cliquez sur "Sauvegarder" ou appuyez sur Entrée pour valider
   - Cliquez sur "Annuler" ou appuyez sur Échap pour annuler

3. **Supprimer une note** :
   - Cliquez sur le bouton "Supprimer" d'une note
   - Confirmez la suppression dans la boîte de dialogue

4. **Synchronisation temps réel** :
   - Toutes les modifications sont automatiquement visibles par tous les utilisateurs connectés
   - Aucun rafraîchissement manuel nécessaire

## Format des Données

Chaque note contient les informations suivantes :

```javascript
{
  id: 1,                    // Identifiant unique (number)
  content: "Contenu de la note", // Texte de la note (string)
  authorId: "user-123",     // Identifiant de l'auteur (string, optionnel)
  createdAt: "2025-10-08T10:30:00.000Z", // Date de création (ISO string)
  updatedAt: "2025-10-08T10:35:00.000Z"  // Date de dernière modification (ISO string)
}
```

## Sécurité (Version Actuelle)

**Authentification JWT complète + Communications temps réel sécurisées.**

Dans cette implémentation :
- **Authentification requise** : Seuls les utilisateurs connectés peuvent créer des notes
- **Contrôle de propriété** : Un utilisateur ne peut modifier/supprimer que ses propres notes
- **Mots de passe hachés** : Utilisation de bcrypt pour sécuriser les mots de passe
- **Tokens JWT** : Authentification par tokens avec expiration (24h)
- **Communications temps réel sécurisées** : Socket.IO authentifié avec JWT
- **Événements Socket.IO contrôlés** : Même règles d'autorisation que l'API REST
- **Synchronisation d'état** : Authentification cohérente entre API et WebSockets
- **Validation des entrées** : Contrôle des données côté serveur
- **Les données ne sont pas persistées** (perdues au redémarrage du serveur)

## Évolutions Futures

Les parties suivantes du TP implémenteront :
- **Tests et validation** : Tests automatisés et validation des entrées
- **Persistance des données** : Base de données pour sauvegarder les notes et utilisateurs
- **Gestion des sessions** : Amélioration de la gestion des tokens JWT
- **Chiffrement HTTPS** : Sécurisation des communications avec TLS/SSL

## Stockage des Données

### Utilisateurs
- **Format** : Fichier JSON (`users.json`)
- **Persistance** : Données sauvegardées automatiquement
- **Sécurité** : Mots de passe hachés avec bcrypt (10 rounds)
- **Structure** :
```json
{
  "id": 1,
  "username": "nom_utilisateur",
  "password": "$2b$10$...",
  "createdAt": "2025-10-08T16:15:50.873Z"
}
```

### Notes
- **Format** : Tableau en mémoire
- **Persistance** : Données perdues au redémarrage
- **Performance** : Accès rapide pour les opérations temps réel

## Notes Techniques

- **Port par défaut** : 3000 (configurable via variable d'environnement `PORT`, port automatique si occupé)
- **WebSockets** : Utilise Socket.IO pour la communication bidirectionnelle avec authentification JWT
- **Événements Socket.IO** : `edit_note`, `delete_note` avec contrôles d'accès identiques à l'API REST
- **Stockage utilisateurs** : Fichier `users.json` persistant (mots de passe hachés avec bcrypt)
- **Stockage notes** : En mémoire (perdues au redémarrage)
- **Validation** : Contrôle basique des entrées côté serveur
- **Gestion d'erreurs** : Messages d'erreur utilisateur et logs serveur
- **Performance** : Données utilisateurs persistées, notes en mémoire pour la rapidité

## Dépannage

### Le serveur ne démarre pas
- Le serveur trouve automatiquement un port disponible (commence par 3000)
- Si aucun port n'est disponible, vérifiez vos processus avec `lsof -i :3000`
- Assurez-vous que Node.js et npm sont installés

### Les modifications ne se synchronisent pas
- Vérifiez la connexion réseau
- Ouvrez la console du navigateur (F12) pour voir les erreurs
- Vérifiez que le serveur Socket.IO fonctionne

### Interface non responsive
- Testez avec un navigateur moderne (Chrome, Firefox, Safari, Edge)
- Vérifiez que JavaScript est activé

## Licence

Ce projet est fourni à des fins éducatives dans le cadre d'un TP.

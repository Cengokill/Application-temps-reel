# Application Todo Liste Temps Réel

Application web de gestion de tâches avec synchronisation en temps réel entre plusieurs onglets. Les données sont sauvegardées dans une base SQLite locale et l'application gère automatiquement les reconnexions.

## Table des matières

- [Architecture](#architecture)
- [Technologies utilisées](#technologies-utilisées)
- [Sécurité](#sécurité)
- [Gestion des erreurs](#gestion-des-erreurs)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Fonctionnalités](#fonctionnalités)
- [Limites connues](#limites-connues)
- [Améliorations possibles](#améliorations-possibles)

## Architecture

L'application fonctionne avec un serveur Node.js qui communique avec le navigateur de deux façons :

1. **HTTP (REST)** : Pour l'inscription et la connexion des utilisateurs
2. **WebSocket (Socket.IO)** : Pour la synchronisation en temps réel des todos

### Base de données

La base SQLite contient 3 tables :

- **users** : id, username, password_hash, created_at
- **todos** : id, user_id, text, completed, created_at, updated_at
- **sessions** : id, user_id, token, created_at

Chaque utilisateur ne peut voir que ses propres todos grâce à la vérification du user_id dans toutes les requêtes.

### Comment ça marche

1. L'utilisateur s'inscrit ou se connecte via HTTP, reçoit un token JWT
2. Le client se connecte en WebSocket avec ce token
3. Quand l'utilisateur ajoute/modifie/supprime un todo, le serveur :
   - Valide les données
   - Sauvegarde dans SQLite
   - Envoie la mise à jour à tous les onglets ouverts
4. Si la connexion est perdue, le client se reconnecte automatiquement avec un délai qui augmente progressivement (1s, 2s, 4s...)

## Technologies utilisées

### Backend

- **Node.js + Express** : Serveur HTTP simple et efficace
- **Socket.IO** : Pour les WebSockets, avec fallback automatique si WebSocket pas disponible
- **SQLite** : Base de données locale, pas besoin de serveur séparé. Parfait pour le dev local
- **bcrypt** : Pour hasher les mots de passe de façon sécurisée
- **JWT** : Tokens d'authentification qui expirent après 24h
- **Winston** : Pour logger les événements dans des fichiers

### Frontend

- **HTML/CSS/JS vanilla** : Pas de framework, juste du JavaScript classique
- **Socket.IO client** : Pour la communication temps réel avec le serveur

## Sécurité

J'ai implémenté plusieurs règles de sécurité :

1. **Rate limiting** : Maximum 100 requêtes par minute par IP pour éviter les abus
2. **Validation serveur** : Tous les inputs sont vérifiés côté serveur (longueur, format, type)
3. **Sanitisation XSS** : Tous les textes sont échappés avec validator.escape() pour éviter l'injection de scripts
4. **JWT avec expiration** : Les tokens expirent après 24h
5. **Limite de todos** : Maximum 50 todos par utilisateur pour éviter l'abus
6. **Hashage bcrypt** : Les mots de passe sont hashés avec bcrypt
7. **Authentification WebSocket** : Seuls les utilisateurs avec un token valide peuvent se connecter
8. **Isolation des données** : Chaque requête vérifie le user_id pour que les utilisateurs ne voient que leurs données

## Gestion des erreurs

### Côté serveur

- Toutes les routes et événements WebSocket sont dans des try/catch
- Les erreurs sont loggées avec Winston
- Messages d'erreur clairs pour l'utilisateur
- Codes HTTP appropriés (400 pour erreur client, 500 pour erreur serveur)

### Côté client

- Détection automatique de la déconnexion
- Affichage du statut de connexion dans l'interface
- Si déconnecté, les actions sont mises en queue et envoyées après reconnexion
- Reconnexion automatique avec exponential backoff (délai qui augmente : 1s, 2s, 4s, 8s... max 30s)

## Installation

### Prérequis

- Node.js 14 ou plus récent
- npm (installé avec Node.js)

### Étapes

1. Aller dans le dossier du projet

2. Installer les dépendances :
```bash
cd server
npm install
```

3. Créer un fichier `.env` dans `server/` pour configurer :
```env
PORT=3000
JWT_SECRET=votre_secret_ici
NODE_ENV=development
```

4. Démarrer le serveur :

**Windows :**
```cmd
start.bat
```

**Manuellement :**
```bash
cd server
npm start
```

5. Ouvrir `http://localhost:3000` dans le navigateur

## Utilisation

### Première fois

1. Cliquer sur l'onglet "Inscription"
2. Choisir un nom d'utilisateur
3. Choisir un mot de passe
4. Cliquer sur "S'inscrire"
5. Vous êtes automatiquement connecté et redirigé vers l'application

### Utiliser l'application

- **Ajouter une tâche** : Écrire dans le champ en haut et cliquer "Ajouter"
- **Compléter** : Cocher la case à gauche de la tâche
- **Modifier** : Cliquer sur l'icône crayon, modifier le texte, appuyer Entrée
- **Supprimer** : Cliquer sur l'icône poubelle et confirmer
- **Filtrer** : Utiliser les boutons "Toutes", "Actives", "Terminées"

### Monitoring

En haut à droite, on peut voir :
- **Statut connexion** : Point vert = connecté, rouge = déconnecté, orange = reconnexion en cours
- **Nombre d'utilisateurs** : Combien de personnes sont connectées
- **Latence** : Temps de réponse moyen en millisecondes (mis à jour toutes les 5 secondes)

### Tester la synchronisation

1. Ouvrir plusieurs onglets **avec le même compte**
2. Ajouter ou modifier une tâche dans un onglet
3. La modification apparaît instantanément dans les autres onglets

### Tester la reconnexion

1. Arrêter le serveur
2. Essayer d'ajouter une tâche (elle sera mise en queue)
3. Redémarrer le serveur
4. La reconnexion se fait automatiquement et la tâche est envoyée

## Fonctionnalités

### Implémentées

- [x] Inscription et connexion utilisateur
- [x] Tokens JWT qui expirent après 24h
- [x] CRUD complet sur les todos (créer, lire, modifier, supprimer)
- [x] Sauvegarde dans SQLite (les données persistent après redémarrage)
- [x] Synchronisation temps réel via WebSocket
- [x] Reconnexion automatique si la connexion est perdue
- [x] Queue d'actions pendant la déconnexion
- [x] Resynchronisation après reconnexion
- [x] Mesure de latence (ping/pong)
- [x] Affichage du nombre d'utilisateurs connectés
- [x] Logs dans des fichiers (Winston)
- [x] Métriques serveur (connexions, messages, erreurs)
- [x] 8 règles de sécurité
- [x] Interface responsive (fonctionne sur mobile)
- [x] Filtres pour voir toutes/actives/terminées

## Limites connues

### Scalabilité

- **SQLite mono-thread** : SQLite ne peut faire qu'une seule écriture à la fois. Si beaucoup d'utilisateurs en même temps, ça peut être lent. Solution : utiliser PostgreSQL ou MySQL à la place.

- **Pas de Redis** : L'application ne peut tourner que sur un seul serveur. Si on veut plusieurs serveurs, il faudrait utiliser Redis adapter pour Socket.IO.

- **Sessions jamais nettoyées** : Les tokens sont stockés en base mais jamais supprimés, même après expiration. La table sessions grandit indéfiniment. Solution : ajouter une tâche qui supprime les tokens expirés régulièrement.

### Sécurité

- **JWT en localStorage** : Les tokens sont stockés dans localStorage, ce qui est vulnérable aux attaques XSS. Solution : utiliser des cookies httpOnly avec refresh tokens.

- **Pas de HTTPS** : En local c'est ok, mais en production il faudrait HTTPS pour protéger les tokens.

- **Rate limiting basique** : Le rate limiting est seulement par IP, pas par utilisateur. Quelqu'un pourrait contourner ça. Solution : combiner IP + user_id.

### Fonctionnalités

- **Pas de partage** : Chaque utilisateur voit seulement ses propres todos. Pas de possibilité de partager une liste avec d'autres utilisateurs.

- **Pas de gestion de conflits** : Si deux onglets modifient le même todo en même temps, le dernier gagne. Solution : utiliser des CRDT ou un système de versioning.

- **Pas de tests** : Il n'y a pas de tests automatisés. Si on modifie le code, il faut tester manuellement.

## Améliorations possibles

### Pour la scalabilité

- Ajouter Redis adapter pour Socket.IO pour pouvoir avoir plusieurs serveurs
- Migrer vers PostgreSQL pour mieux gérer la concurrence
- Ajouter un load balancer (Nginx) avec sticky sessions

### Pour la sécurité

- Implémenter refresh tokens (access token court + refresh token long)
- Ajouter HTTPS en production
- Améliorer le rate limiting (par utilisateur en plus de par IP)
- Nettoyer les tokens expirés automatiquement

### Pour les fonctionnalités

- Permettre de partager des listes avec d'autres utilisateurs
- Ajouter des tags/catégories pour organiser les todos
- Recherche dans les todos
- Notifications pour rappels
- Export/import des todos (CSV, JSON)

### Pour le monitoring

- Dashboard avec graphiques (avec Grafana + Prometheus)
- Alertes automatiques si trop d'erreurs
- suivi des erreurs

### Pour le développement

- Ajouter des tests automatisés
- CI/CD avec GitHub Actions
- Docker pour faciliter le déploiement
- Documentation API avec Swagger

---

**Projet réalisé pour :** Exercice 8 - Persistance et Monitoring  
**Technologies :** Node.js, Express, Socket.IO, SQLite, JWT, bcrypt, Winston 

Killian Cengo

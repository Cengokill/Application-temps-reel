# Application Todo Liste Temps Réel

Petite application web de gestion de tâches avec synchronisation en temps réel entre plusieurs onglets. Les données sont stockées dans une base SQLite locale et l'application gère toute seule les reconnexions.

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

L'appli tourne sur un serveur Node.js qui communique avec le navigateur de 2 manières :

1. **HTTP (REST)** : Pour l'inscription et le login des users
2. **WebSocket (Socket.IO)** : Pour la synchro en temps réel des todos

### Base de données

La base SQLite a 3 tables :

- **users** : id, username, password_hash, created_at
- **todos** : id, user_id, text, completed, created_at, updated_at
- **sessions** : id, user_id, token, created_at

Chaque utilisateur ne voit que ses propres todos grace à la vérification du `user_id` dans toutes les requêtes.

### Le fonctionnement

1. L'utilisateur s'inscrit ou se connecte en HTTP, il reçoit un token JWT
2. Le client se connecte au WebSocket avec ce token
3. Quand on ajoute/modifie/supprime un todo, le serveur :
   - Valide les données
   - Sauvegarde dans SQLite
   - Envoie la mise à jour à tous les onglets ouverts
4. Si la connexion saute, le client se reconnecte automatiquement avec un délai progressif (1s, 2s, 4s...)

## Technologies utilisées

### Backend

- **Node.js + Express** : Serveur HTTP simple et efficace
- **Socket.IO** : Pour les WebSockets, avec fallback auto si besoin
- **SQLite** : BDD locale, pratique pour le dev, pas besoin de configurer un gros serveur
- **bcrypt** : Pour hasher les mots de passe
- **JWT** : Tokens d'auth (expirent après 24h)
- **Winston** : Pour les logs dans des fichiers

### Frontend

- **HTML/CSS/JS vanilla** : Pas de framework, juste du JS pur
- **Socket.IO client** : Pour le temps réel

## Sécurité

J'ai mis en place pas mal de règles de sécurité :

1. **Rate limiting** : Max 100 requetes/min par IP pour éviter le spam
2. **Validation serveur** : Tous les inputs sont checkés côté serveur (taille, type...)
3. **Sanitisation XSS** : Les textes sont échappés avec `validator.escape()` pour éviter les injections
4. **JWT avec expiration** : Les tokens ne sont valides que 24h
5. **Limite de todos** : Max 50 todos par user (pour éviter les abus)
6. **Hachage bcrypt** : Les mots de passe sont hashés, jamais stockés en clair
7. **Auth WebSocket** : Impossible de se connecter au socket sans token valide
8. **Isolation** : On vérifie toujours le `user_id` pour que personne ne voie les tâches des autres

## Gestion des erreurs

### Côté serveur

- Toutes les routes et events WebSocket sont dans des try/catch
- Les erreurs partent dans les logs Winston
- Messages d'erreur clairs renvoyés au client
- Codes HTTP corrects (400, 401, 500...)

### Côté client

- Détection auto de la déconnexion
- Affichage de l'état (connecté/déconnecté) dans l'UI
- Si on est hors ligne, les actions sont mises dans une file d'attente et envoyées au retour de la connexion
- Reconnexion automatique (backoff exponentiel)

## Installation

### Prérequis

- Node.js 14+
- npm

### Étapes

1. Aller dans le dossier du projet

2. Installer les dépendances :
```bash
cd server
npm install
```
3. Lancer le serveur :
```bash
npm start
```

4. Ouvrir `http://localhost:3000`

## Utilisation

1. Onglet "Inscription"
2. Choisir un pseudo et un mot de passe
3. Valider
4. Vous êtes connecté direct

- **Ajouter** : Champ en haut + Entrée ou bouton
- **Compléter** : Checkbox à gauche
- **Modifier** : Clic sur le crayon -> modif -> Entrée
- **Supprimer** : Clic sur la poubelle
- **Filtres** : Boutons en haut de liste

### Monitoring

En haut à droite :
- **Statut** : Pastille verte/rouge
- **Utilisateurs** : Nombre de clients connectés en ce moment
- **Latence** : Ping moyen en ms (refresh toutes les 5s)

### Tester la synchro

1. Ouvrez 2 onglets avec le même compte
2. Ajoutez un truc sur l'un
3. Ça apparait direct sur l'autre

### Tester la reconnexion

1. Coupez le serveur
2. Essayez d'ajouter une tâche (elle part pas)
3. Relancez le serveur
4. La tâche devrait partir toute seule à la reconnexion

## Fonctionnalités

- [x] Inscription / Login
- [x] JWT (24h)
- [x] CRUD complet (toutes les opérations de base)
- [x] Persistance SQLite (ça reste après restart)
- [x] Temps réel (WebSocket)
- [x] Reconnexion auto
- [x] File d'attente hors ligne
- [x] Ping/Pong pour la latence
- [x] Compteur de users
- [x] Logs fichiers
- [x] Sécurité (8 règles)
- [x] Responsive (mobile ok)
- [x] Filtres (Actives/Terminées)

## Limites connues

### Scalabilité

- **SQLite** : C'est du fichier local, donc mono-thread sur les écritures. Si y'a trop de monde ça va ramer. Faudrait passer sur Postgres.
- **Pas de Redis** : On peut pas mettre plusieurs serveurs en parallèle car Socket.IO a besoin d'un adapter (Redis) pour synchroniser les instances.
- **Nettoyage** : Les sessions expirées restent en base pour l'instant. Faudrait un script de nettoyage (cron).

### Sécurité

- **LocalStorage** : On stocke le JWT dans le localStorage, c'est sensible aux XSS. L'idéal serait des cookies `httpOnly` (j'ai déjà codé ça sur mon projet annuel, désormais dispo sur www.georelic.com).
- **HTTP** : En local ça va, mais faut impérativement du HTTPS en prod.
- **Rate limit** : C'est par IP, donc un user pourrait contourner en changeant d'IP.

### Fonctionnalités

- **Pas de partage** : C'est une liste perso, on peut pas inviter des gens sur sa liste.
- **Conflits** : Si on modifie le même item sur 2 onglets en meme temps, c'est le dernier qui gagne.

## Améliorations possibles

### Tech

- Mettre Redis pour pouvoir scaler
- Passer sur PostgreSQL
- Mettre un Nginx devant

### Sécurité

- Refresh tokens + cookies
- HTTPS
- Rate limit par user ID

### Features

- Partage de listes
- Catégories / Tags
- Recherche si beaucoup de listes
- Notifications
- Export des données sur mobile ?

### Dev

- Rajouter des tests unitaires (il y en a pas pour l'instant)
- CI/CD
- Dockeriser le tout

---

**Projet réalisé pour :** Exercice 8 - Persistance et Monitoring  
**URL :** https://github.com/Laudroid/Live-App-Temps-Reel/blob/main/exercice-8-Persistance-et-monitoring.md
**Technologies :** Node.js, Express, Socket.IO, SQLite, JWT, bcrypt, Winston 

Killian Cengo

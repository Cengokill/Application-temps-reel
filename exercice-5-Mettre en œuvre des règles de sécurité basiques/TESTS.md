# 🧪 Guide de Tests - Tableau de Bord Collaboratif

Ce document fournit des scénarios de tests détaillés pour valider toutes les fonctionnalités de sécurité.

## Préparation des Tests

### Démarrage du Serveur

```bash
# Naviguer dans le dossier
cd "exercice-8-Mettre en œuvre des règles de sécurité basiques/server"

# Installer les dépendances (si ce n'est pas déjà fait)
npm install

# Démarrer le serveur
npm start
```

Le serveur devrait afficher :
```
✅ Prêt à recevoir des connexions !
```

### Navigateurs pour les Tests

Pour tester les fonctionnalités collaboratives, vous aurez besoin de :
- **2 navigateurs différents** (ex: Chrome + Firefox)
- **OU** 1 navigateur normal + 1 fenêtre de navigation privée
- **OU** 2 profils utilisateur différents dans le même navigateur

## Tests d'Authentification

### Test 1 : Inscription Réussie ✅

**Objectif** : Vérifier que l'inscription fonctionne correctement

**Étapes** :
1. Ouvrir `http://localhost:3000`
2. Cliquer sur "S'inscrire"
3. Entrer :
   - Nom d'utilisateur : `alice`
   - Mot de passe : `password123`
   - Confirmation : `password123`
4. Cliquer sur "S'inscrire"

**Résultat attendu** :
- ✅ Message "Inscription réussie ! Redirection..."
- ✅ Redirection vers `/app.html`
- ✅ Header affiche "Connecté en tant que **alice**"

**Vérification backend** :
- Le fichier `server/users.json` contient un utilisateur avec `username: "alice"`
- Le mot de passe est hashé (commence par `$2b$10$...`)

---

### Test 2 : Inscription avec Nom d'Utilisateur Déjà Pris ❌

**Objectif** : Vérifier la validation des noms d'utilisateur uniques

**Étapes** :
1. Se déconnecter
2. Revenir sur la page d'inscription
3. Essayer de s'inscrire avec `alice` / `autremdp123`

**Résultat attendu** :
- ❌ Message d'erreur : "Ce nom d'utilisateur est déjà pris"
- ❌ Pas de redirection

---

### Test 3 : Validation des Entrées ❌

**Objectif** : Vérifier la validation des champs

**Sous-test A : Nom d'utilisateur trop court**
1. Inscription avec username : `ab` (2 caractères)
2. **Résultat** : ❌ "Le nom d'utilisateur doit contenir au moins 3 caractères"

**Sous-test B : Mot de passe trop court**
1. Inscription avec password : `12345` (5 caractères)
2. **Résultat** : ❌ "Le mot de passe doit contenir au moins 6 caractères"

**Sous-test C : Mots de passe ne correspondent pas**
1. Password : `password123`
2. Confirmation : `password456`
3. **Résultat** : ❌ "Les mots de passe ne correspondent pas"

---

### Test 4 : Connexion Réussie ✅

**Objectif** : Vérifier la connexion avec un compte existant

**Étapes** :
1. Se déconnecter
2. Sur la page de connexion, entrer :
   - Username : `alice`
   - Password : `password123`
3. Cliquer sur "Se connecter"

**Résultat attendu** :
- ✅ Message "Connexion réussie ! Redirection..."
- ✅ Redirection vers `/app.html`
- ✅ Accès au tableau de bord

---

### Test 5 : Connexion Échouée ❌

**Objectif** : Vérifier le rejet des mauvais identifiants

**Sous-test A : Mauvais mot de passe**
1. Username : `alice`
2. Password : `mauvaismdp`
3. **Résultat** : ❌ "Nom d'utilisateur ou mot de passe incorrect"

**Sous-test B : Utilisateur inexistant**
1. Username : `utilisateurinexistant`
2. Password : `password123`
3. **Résultat** : ❌ "Nom d'utilisateur ou mot de passe incorrect"

---

### Test 6 : Persistance de Session ✅

**Objectif** : Vérifier que la session persiste après rafraîchissement

**Étapes** :
1. Connecté en tant qu'Alice
2. Rafraîchir la page (F5)

**Résultat attendu** :
- ✅ Toujours connecté
- ✅ Pas de redirection vers la page de connexion
- ✅ Données affichées correctement

---

## Tests de Gestion des Notes

### Test 7 : Création de Note ✅

**Objectif** : Vérifier la création d'une note

**Étapes** :
1. Connecté en tant qu'Alice
2. Dans la zone "Créer une nouvelle note", entrer :
   ```
   Ceci est ma première note !
   ```
3. Cliquer sur "➕ Ajouter la note"

**Résultat attendu** :
- ✅ Message "Note créée avec succès !"
- ✅ La note apparaît dans la grille
- ✅ L'auteur affiché est "alice" avec icône 👤
- ✅ Statistiques mises à jour (Mes notes : 1)
- ✅ Boutons ✏️ et 🗑️ visibles sur la note

**Vérification backend** :
- `server/notes.json` contient la note avec `authorId: 1` et `authorUsername: "alice"`

---

### Test 8 : Validation du Contenu ❌

**Objectif** : Vérifier les limites de contenu

**Sous-test A : Note vide**
1. Laisser le champ vide
2. Cliquer sur "Ajouter"
3. **Résultat** : ❌ Validation HTML (required)

**Sous-test B : Note trop longue**
1. Entrer plus de 1000 caractères
2. **Résultat** : ❌ Le textarea limite à 1000 caractères (maxlength)

---

### Test 9 : Modification de sa Propre Note ✅

**Objectif** : Vérifier qu'on peut modifier ses notes

**Étapes** :
1. Cliquer sur ✏️ sur la note d'Alice
2. Modifier le texte :
   ```
   Ceci est ma première note MODIFIÉE !
   ```
3. Cliquer sur "💾 Sauvegarder"

**Résultat attendu** :
- ✅ Message "Note modifiée avec succès !"
- ✅ La note affiche le nouveau contenu
- ✅ Indication "✏️ Il y a Xmin" dans le footer de la note

---

### Test 10 : Suppression de sa Propre Note ✅

**Objectif** : Vérifier qu'on peut supprimer ses notes

**Étapes** :
1. Créer une note temporaire
2. Cliquer sur 🗑️ sur cette note
3. Dans le modal, cliquer sur "🗑️ Supprimer"

**Résultat attendu** :
- ✅ Message "Note supprimée avec succès !"
- ✅ La note disparaît de la grille
- ✅ Statistiques mises à jour

---

## Tests d'Autorisation

### Test 11 : Multi-Utilisateurs - Configuration 🔧

**Objectif** : Préparer deux utilisateurs pour les tests collaboratifs

**Étapes** :
1. **Navigateur 1** : Créer et se connecter avec `alice` / `password123`
2. **Navigateur 2** (privé ou autre navigateur) : Créer et se connecter avec `bob` / `password123`
3. **Alice** : Créer une note "Note d'Alice"
4. **Bob** : Créer une note "Note de Bob"

**Résultat attendu** :
- ✅ Les deux utilisateurs voient les deux notes
- ✅ Notes d'Alice affichent 👤 "alice" chez Alice, 👥 "alice" chez Bob
- ✅ Notes de Bob affichent 👤 "bob" chez Bob, 👥 "bob" chez Alice

---

### Test 12 : Impossibilité de Modifier la Note d'Autrui ❌

**Objectif** : Vérifier l'autorisation avant modification

**Étapes** :
1. **Bob** regarde la note d'Alice

**Résultat attendu** :
- ❌ Pas de bouton ✏️ sur la note d'Alice
- ❌ Pas de bouton 🗑️ sur la note d'Alice
- ✅ Seuls les boutons sont visibles sur les notes de Bob

**Test API Direct** (avec curl ou Postman) :
```bash
# Récupérer le token de Bob depuis localStorage
# Essayer de modifier la note #1 d'Alice

curl -X PUT http://localhost:3000/notes/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_de_bob>" \
  -d '{"content":"Bob essaie de modifier"}'
```

**Résultat** :
```json
{
  "error": "Vous ne pouvez modifier que vos propres notes"
}
```
Code HTTP : `403 Forbidden`

---

### Test 13 : Impossibilité de Supprimer la Note d'Autrui ❌

**Objectif** : Vérifier l'autorisation avant suppression

**Test API Direct** :
```bash
curl -X DELETE http://localhost:3000/notes/1 \
  -H "Authorization: Bearer <token_de_bob>"
```

**Résultat** :
```json
{
  "error": "Vous ne pouvez supprimer que vos propres notes"
}
```
Code HTTP : `403 Forbidden`

---

## Tests Temps Réel (Socket.IO)

### Test 14 : Synchronisation en Temps Réel ✅

**Objectif** : Vérifier la synchronisation Socket.IO

**Configuration** :
- **Navigateur 1** : Alice connectée
- **Navigateur 2** : Bob connecté
- Positionner les deux fenêtres côte à côte

**Scénario A : Création**
1. **Alice** crée une note "Test temps réel"
2. **Observez Bob** : ✅ La note apparaît instantanément (sans rafraîchir)

**Scénario B : Modification**
1. **Alice** modifie la note
2. **Observez Bob** : ✅ La modification apparaît instantanément

**Scénario C : Suppression**
1. **Alice** supprime la note
2. **Observez Bob** : ✅ La note disparaît instantanément

**Scénario D : Statistiques**
1. **Alice** crée une note
2. **Observez Bob** : ✅ Les statistiques se mettent à jour (Total +1, Autres +1)

---

### Test 15 : Indicateur de Connexion Socket.IO 🔌

**Objectif** : Vérifier l'indicateur de statut

**Étapes** :
1. Observer le header : "● Connecté" avec point vert
2. Arrêter le serveur (Ctrl+C)
3. Observer le changement : "● Déconnecté" avec point gris
4. Redémarrer le serveur
5. Observer la reconnexion automatique

**Résultat attendu** :
- ✅ Indicateur vert quand connecté
- ✅ Indicateur gris quand déconnecté
- ✅ Reconnexion automatique

---

### Test 16 : Authentification Socket.IO ❌

**Objectif** : Vérifier que Socket.IO nécessite authentification

**Test** (avec console développeur) :
```javascript
// Dans la console du navigateur, essayer de se connecter sans token
const socket = io({ auth: { token: 'token_invalide' } });

socket.on('connect_error', (err) => {
  console.log(err.message); // "Token invalide ou expiré"
});
```

**Résultat attendu** :
- ❌ Connexion refusée
- ❌ Message d'erreur

---

## Tests de Sécurité

### Test 17 : Protection XSS ✅

**Objectif** : Vérifier l'échappement des scripts malveillants

**Étapes** :
1. Créer une note avec le contenu :
   ```html
   <script>alert('XSS')</script>
   <img src=x onerror="alert('XSS')">
   ```
2. Observer l'affichage

**Résultat attendu** :
- ✅ Le texte s'affiche tel quel (pas d'exécution)
- ✅ Pas d'alerte JavaScript
- ✅ Inspection du HTML montre : `&lt;script&gt;...`

---

### Test 18 : Expiration du Token ⏰

**Objectif** : Vérifier l'expiration du token après 24h

**Simulation** :
1. Se connecter
2. Récupérer le token depuis localStorage
3. Décoder sur [jwt.io](https://jwt.io)
4. Vérifier le champ `exp` (timestamp Unix)

**Test rapide** (modifier le serveur temporairement) :
```javascript
// Dans server/index.js, changer temporairement
{ expiresIn: '10s' }  // 10 secondes au lieu de 24h
```

1. Se connecter
2. Attendre 11 secondes
3. Essayer de créer une note

**Résultat attendu** :
- ❌ Erreur "Token invalide ou expiré"
- ✅ Déconnexion automatique
- ✅ Redirection vers la page de connexion

---

### Test 19 : Accès Direct sans Token ❌

**Objectif** : Vérifier la protection des routes

**Test A : API sans token**
```bash
curl http://localhost:3000/notes -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"Test sans auth"}'
```

**Résultat** :
```json
{
  "error": "Token d'accès requis"
}
```
Code HTTP : `401 Unauthorized`

**Test B : Accès direct à app.html**
1. Supprimer le token : `localStorage.removeItem('token')`
2. Recharger la page `/app.html`

**Résultat** :
- ✅ Redirection automatique vers `/index.html`

---

### Test 20 : Hashage des Mots de Passe 🔐

**Objectif** : Vérifier que les mots de passe ne sont jamais stockés en clair

**Étapes** :
1. Créer un utilisateur
2. Ouvrir `server/users.json`
3. Observer le champ `password`

**Résultat attendu** :
```json
{
  "id": 1,
  "username": "alice",
  "password": "$2b$10$nOUIs5kJ7naTuTFkBy1veu...",  // ← Hash bcrypt
  "createdAt": "..."
}
```

- ✅ Le mot de passe commence par `$2b$10$` (bcrypt)
- ✅ Longueur d'environ 60 caractères
- ✅ Impossible de retrouver le mot de passe original

---

## Tests de Filtres et Interface

### Test 21 : Filtres de Notes 🔍

**Configuration** :
- Alice a créé 3 notes
- Bob a créé 2 notes

**Test A : Filtre "Toutes"**
1. Cliquer sur "Toutes"
2. **Résultat** : ✅ 5 notes affichées

**Test B : Filtre "Mes notes"**
1. **Alice** clique sur "Mes notes"
2. **Résultat** : ✅ 3 notes (seulement celles d'Alice)

**Test C : Filtre "Autres"**
1. **Alice** clique sur "Autres"
2. **Résultat** : ✅ 2 notes (seulement celles de Bob)

---

### Test 22 : Responsive Design 📱

**Objectif** : Vérifier l'adaptation mobile

**Étapes** :
1. Ouvrir les DevTools (F12)
2. Activer le mode responsive
3. Tester différentes tailles :
   - Mobile : 375x667 (iPhone)
   - Tablet : 768x1024 (iPad)
   - Desktop : 1920x1080

**Résultat attendu** :
- ✅ Layout adapté à chaque taille
- ✅ Pas de dépassement horizontal
- ✅ Boutons et textes lisibles
- ✅ Notes empilées verticalement sur mobile

---

## Tests de Persistance

### Test 23 : Persistance des Utilisateurs 💾

**Étapes** :
1. Créer un utilisateur `charlie` / `password123`
2. Arrêter le serveur (Ctrl+C)
3. Redémarrer le serveur
4. Essayer de se connecter avec `charlie` / `password123`

**Résultat attendu** :
- ✅ Connexion réussie
- ✅ L'utilisateur existe toujours

---

### Test 24 : Persistance des Notes 💾

**Étapes** :
1. Créer plusieurs notes
2. Noter le nombre de notes
3. Arrêter le serveur
4. Redémarrer le serveur
5. Se reconnecter

**Résultat attendu** :
- ✅ Toutes les notes sont toujours présentes
- ✅ Contenu intact
- ✅ Auteurs corrects

---

## Checklist Complète des Tests

### Authentification
- ✅ Test 1 : Inscription réussie
- ✅ Test 2 : Nom d'utilisateur déjà pris
- ✅ Test 3 : Validation des entrées
- ✅ Test 4 : Connexion réussie
- ✅ Test 5 : Connexion échouée
- ✅ Test 6 : Persistance de session

### Gestion des Notes
- ✅ Test 7 : Création de note
- ✅ Test 8 : Validation du contenu
- ✅ Test 9 : Modification de sa note
- ✅ Test 10 : Suppression de sa note

### Autorisation
- ✅ Test 11 : Configuration multi-utilisateurs
- ✅ Test 12 : Impossibilité de modifier note d'autrui
- ✅ Test 13 : Impossibilité de supprimer note d'autrui

### Temps Réel
- ✅ Test 14 : Synchronisation en temps réel
- ✅ Test 15 : Indicateur de connexion
- ✅ Test 16 : Authentification Socket.IO

### Sécurité
- ✅ Test 17 : Protection XSS
- ✅ Test 18 : Expiration du token
- ✅ Test 19 : Accès sans token
- ✅ Test 20 : Hashage des mots de passe

### Interface
- ✅ Test 21 : Filtres de notes
- ✅ Test 22 : Responsive design

### Persistance
- ✅ Test 23 : Persistance des utilisateurs
- ✅ Test 24 : Persistance des notes

---

## Rapport de Tests

Utilisez ce tableau pour suivre vos tests :

| Test | Statut | Notes |
|------|--------|-------|
| Test 1 | ⬜ | |
| Test 2 | ⬜ | |
| Test 3 | ⬜ | |
| Test 4 | ⬜ | |
| Test 5 | ⬜ | |
| Test 6 | ⬜ | |
| Test 7 | ⬜ | |
| Test 8 | ⬜ | |
| Test 9 | ⬜ | |
| Test 10 | ⬜ | |
| Test 11 | ⬜ | |
| Test 12 | ⬜ | |
| Test 13 | ⬜ | |
| Test 14 | ⬜ | |
| Test 15 | ⬜ | |
| Test 16 | ⬜ | |
| Test 17 | ⬜ | |
| Test 18 | ⬜ | |
| Test 19 | ⬜ | |
| Test 20 | ⬜ | |
| Test 21 | ⬜ | |
| Test 22 | ⬜ | |
| Test 23 | ⬜ | |
| Test 24 | ⬜ | |

Légende : ⬜ À faire | ✅ Réussi | ❌ Échoué

---

**Bonne chance avec vos tests ! 🧪**


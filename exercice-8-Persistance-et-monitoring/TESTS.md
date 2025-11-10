# Guide de Tests Manuels

Ce document décrit les tests manuels à effectuer pour vérifier le bon fonctionnement de l'application.

## Préparation

1. Démarrer le serveur avec `./start.sh` (Linux/Mac) ou `start.bat` (Windows)
2. Vérifier que le serveur démarre sans erreur
3. Ouvrir le navigateur sur `http://localhost:3000`

## Test 1 - Inscription et Authentification

### Objectif
Vérifier que l'inscription et la connexion fonctionnent correctement.

### Étapes

1. **Inscription**
   - Aller sur `http://localhost:3000`
   - Cliquer sur l'onglet "Inscription"
   - Entrer un nom d'utilisateur (ex: `testuser1`)
   - Entrer un mot de passe (ex: `test1234`)
   - Confirmer le mot de passe
   - Cliquer sur "S'inscrire"

2. **Résultat attendu**
   - Redirection automatique vers `/app.html`
   - Nom d'utilisateur affiché dans le badge en haut
   - Statut de connexion: "Connecté" (point vert)

3. **Déconnexion**
   - Cliquer sur "Déconnexion"
   - Confirmation demandée
   - Redirection vers page de login

4. **Connexion**
   - Entrer les mêmes identifiants
   - Cliquer sur "Se connecter"
   - Redirection vers l'application

5. **Validation des erreurs**
   - Essayer de créer un compte avec un nom déjà pris -> erreur affichée
   - Essayer de se connecter avec mauvais mot de passe -> erreur affichée
   - Essayer nom d'utilisateur trop court (< 3 caractères) -> erreur
   - Essayer mot de passe trop court (< 4 caractères) -> erreur

## Test 2 - CRUD des Todos

### Objectif
Vérifier les opérations de création, lecture, modification et suppression.

### Étapes

1. **Création de todos**
   - Entrer "Faire les courses" dans le champ
   - Cliquer "Ajouter"
   - Vérifier que le todo apparait dans la liste
   - Ajouter 4-5 autres todos

2. **Résultat attendu**
   - Chaque todo apparait instantanément
   - Date de création affichée
   - Compteur mis à jour (ex: "5 tâche(s)")

3. **Complétion de todo**
   - Cocher la case d'un todo
   - Vérifier que le texte devient barré
   - Vérifier que le compteur "terminée(s)" augmente

4. **Modification de todo**
   - Cliquer sur l'icône crayon
   - Modifier le texte
   - Appuyer Entrée ou cliquer ailleurs
   - Vérifier que la modification est sauvegardée

5. **Suppression de todo**
   - Cliquer sur l'icône poubelle
   - Confirmer la suppression
   - Vérifier que le todo disparait
   - Vérifier que le compteur est mis à jour

6. **Filtres**
   - Cliquer sur "Actives" -> seuls les todos non cochés apparaissent
   - Cliquer sur "Terminées" -> seuls les todos cochés apparaissent
   - Cliquer sur "Toutes" -> tous les todos réapparaissent

## Test 3 - Synchronisation Multi-Onglets

### Objectif
Vérifier que les changements se synchronisent en temps réel entre onglets.

### Étapes

1. **Préparation**
   - Se connecter avec le même compte dans l'onglet 1
   - Dupliquer l'onglet (Ctrl+Shift+D ou clic droit > dupliquer)
   - Placer les deux onglets côte à côte

2. **Test création**
   - Dans onglet 1: ajouter un todo "Test sync 1"
   - Observer l'onglet 2: le todo doit apparaitre instantanément

3. **Test modification**
   - Dans onglet 2: modifier un todo existant
   - Observer l'onglet 1: la modification doit apparaitre

4. **Test complétion**
   - Dans onglet 1: cocher un todo
   - Observer l'onglet 2: le todo doit se barrer

5. **Test suppression**
   - Dans onglet 2: supprimer un todo
   - Observer l'onglet 1: le todo doit disparaitre

6. **Résultat attendu**
   - Toutes les opérations sont synchronisées instantanément
   - Aucun délai perceptible (< 100ms)
   - Pas d'erreur dans la console

## Test 4 - Persistance des Données

### Objectif
Vérifier que les données survivent au redémarrage du serveur.

### Étapes

1. **Avant redémarrage**
   - Créer 3-4 todos
   - Noter leur contenu

2. **Redémarrage serveur**
   - Arrêter le serveur (Ctrl+C dans le terminal)
   - Redémarrer avec `./start.sh` ou `start.bat`
   - Rafraichir la page navigateur

3. **Résultat attendu**
   - Les todos sont toujours présents
   - Leur état (complété/non-complété) est préservé
   - Les dates de création sont correctes

4. **Vérification base de données**
   - Aller dans `server/`
   - Vérifier qu'un fichier `todos.db` existe
   - (Optionnel) Ouvrir avec un client SQLite

## Test 5 - Reconnexion Automatique

### Objectif
Vérifier le mécanisme de reconnexion automatique avec exponential backoff.

### Étapes

1. **Simulation déconnexion**
   - Application ouverte et connectée
   - Arrêter le serveur (Ctrl+C)
   - Observer le statut de connexion

2. **Résultat attendu**
   - Statut passe à "Déconnecté" (point rouge)
   - Puis "Reconnexion dans Xs..." (point orange)
   - Délais augmentent: 1s, 2s, 4s, 8s, etc.

3. **Test queue d'actions**
   - Pendant que déconnecté, essayer d'ajouter un todo
   - Observer le message d'erreur
   - Vérifier que le todo n'apparait pas encore

4. **Reconnexion**
   - Redémarrer le serveur
   - Observer la reconnexion automatique
   - Statut doit repasser à "Connecté"

5. **Traitement de la queue**
   - Le todo ajouté pendant déconnexion doit apparaitre
   - Une synchronisation complète doit se faire

6. **Console navigateur**
   - Ouvrir DevTools (F12)
   - Observer les logs de reconnexion
   - Vérifier les délais exponentiels

## Test 6 - Monitoring

### Objectif
Vérifier que les métriques de monitoring fonctionnent.

### Étapes

1. **Nombre d'utilisateurs**
   - Noter le nombre affiché (ex: "1")
   - Ouvrir un nouvel onglet avec le même compte
   - Vérifier que le nombre augmente à "2"
   - Fermer l'onglet
   - Vérifier que le nombre redescend à "1"

2. **Latence**
   - Observer le champ "Latence"
   - Doit afficher une valeur en ms (ex: "15 ms")
   - Valeur doit se mettre à jour toutes les 5 secondes
   - Valeur typique: 5-50ms en local

3. **Logs serveur**
   - Observer le terminal où tourne le serveur
   - Vérifier les logs de connexion/déconnexion
   - Vérifier les logs de création/modification de todos
   - Toutes les 30s, un log de métriques apparait

4. **Fichiers de logs**
   - Aller dans le dossier `logs/`
   - Vérifier l'existence de `app.log`
   - Vérifier l'existence de `error.log`
   - Ouvrir et vérifier le format JSON

5. **Endpoint santé**
   - Ouvrir `http://localhost:3000/api/health`
   - Vérifier la réponse JSON avec métriques:
     ```json
     {
       "status": "ok",
       "metrics": {
         "connections": { "active": 1, "total": 5 },
         "messages": { "total": 42, "perSecond": 2 },
         "latency": { "average": 15, "samples": 10 },
         "errors": 0,
         "uptime": 120
       }
     }
     ```

## Test 7 - Sécurité

### Objectif
Vérifier les mesures de sécurité implémentées.

### Étapes

1. **Validation longueur**
   - Essayer de créer un todo avec texte très long (> 500 caractères)
   - Vérifier qu'une erreur est affichée
   - Essayer nom d'utilisateur > 20 caractères
   - Vérifier qu'une erreur est affichée

2. **Sanitisation XSS**
   - Créer un todo avec `<script>alert('XSS')</script>`
   - Vérifier que le script ne s'exécute PAS
   - Le texte doit apparaitre échappé

3. **Limite de todos**
   - Créer 50 todos (peut utiliser un script ou manuellement)
   - Essayer de créer le 51ème
   - Vérifier qu'un message d'erreur apparait

4. **Token JWT**
   - Ouvrir DevTools > Application > Local Storage
   - Copier le token
   - Le supprimer du localStorage
   - Rafraichir la page
   - Vérifier redirection vers login
   - Remettre le token
   - Rafraichir
   - Vérifier que ça fonctionne

5. **Rate limiting**
   - Faire beaucoup de requêtes rapidement (> 100/min)
   - Ouvrir un script dans la console:
     ```javascript
     for(let i = 0; i < 110; i++) {
       fetch('/api/health');
     }
     ```
   - Vérifier qu'après ~100 requêtes, erreur 429 (Too Many Requests)

6. **Isolation utilisateurs**
   - Se connecter avec user1 dans onglet 1
   - Créer quelques todos
   - Se déconnecter
   - Créer un nouveau compte user2 dans onglet 2
   - Vérifier que user2 NE VOIT PAS les todos de user1
   - Vérifier que chaque user voit seulement ses propres todos

## Test 8 - Interface Responsive

### Objectif
Vérifier que l'interface s'adapte aux différentes tailles d'écran.

### Étapes

1. **Desktop**
   - Vérifier l'affichage en plein écran
   - Tous les éléments doivent être alignés correctement

2. **Tablette**
   - Ouvrir DevTools (F12)
   - Activer le mode responsive (Ctrl+Shift+M)
   - Sélectionner "iPad"
   - Vérifier que l'interface s'adapte

3. **Mobile**
   - Sélectionner "iPhone 12"
   - Vérifier que:
     - Le header passe en colonne
     - Les indicateurs sont empilés verticalement
     - Le formulaire d'ajout est en colonne
     - Les todos sont lisibles

4. **Redimensionnement**
   - Redimensionner la fenêtre progressivement
   - Vérifier qu'il n'y a pas de casse visuelle
   - Vérifier que tout reste accessible

## Résultats

### Checklist globale

- [ ] Inscription fonctionne
- [ ] Connexion fonctionne
- [ ] Validation des erreurs d'authentification
- [ ] Création de todos
- [ ] Modification de todos
- [ ] Complétion de todos
- [ ] Suppression de todos
- [ ] Filtres (toutes/actives/terminées)
- [ ] Synchronisation multi-onglets instantanée
- [ ] Persistance après redémarrage serveur
- [ ] Reconnexion automatique avec exponential backoff
- [ ] Queue d'actions pendant déconnexion
- [ ] Nombre d'utilisateurs connectés correct
- [ ] Latence mesurée et affichée
- [ ] Logs serveur fonctionnels
- [ ] Logs fichiers créés
- [ ] Endpoint /api/health répond
- [ ] Validation longueur textes
- [ ] Sanitisation XSS
- [ ] Limite 50 todos par user
- [ ] Rate limiting (429 après abus)
- [ ] Isolation des données par user
- [ ] Interface responsive (mobile/tablette/desktop)

### Bugs trouvés

Documenter ici tout bug découvert lors des tests:

1. 
2. 
3. 

### Améliorations suggérées

Documenter ici les améliorations identifiées:

1. 
2. 
3. 

---

**Date des tests:** ___________  
**Testé par:** ___________  
**Résultat global:** [ ] Réussi [ ] Échoué [ ] Partiel  


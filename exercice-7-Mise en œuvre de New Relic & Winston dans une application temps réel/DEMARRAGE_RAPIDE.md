# 🚀 Démarrage Rapide

## Pour afficher la page web

### Étape 1 : Vérifier que le serveur est démarré

Si vous avez déjà exécuté `start.bat`, le serveur devrait être en cours d'exécution.

Vous devriez voir dans la console :

```
✓ Serveur démarré sur http://localhost:3000
✓ Interface web: http://localhost:3000
✓ New Relic: Activé
✓ Log Level: debug
```

### Étape 2 : Ouvrir le navigateur

Ouvrez votre navigateur web (Chrome, Firefox, Edge, etc.) et accédez à :

**👉 http://localhost:3000**

ou simplement

**👉 localhost:3000**

### Étape 3 : Utiliser l'interface

Vous verrez une **interface web moderne** avec :

- 🟢 **4 boutons de test** pour chaque route (ping, slow, error, debug)
- 📊 **Statut du serveur** en temps réel
- 🔥 **Test de charge** pour envoyer plusieurs requêtes
- 📝 **Logs en direct** affichés dans le navigateur
- 📈 **Compteur de requêtes**

## Résolution de problèmes

### Le serveur n'est pas démarré

Si vous voyez "Impossible d'accéder au site" dans le navigateur :

```bash
# Relancer le serveur
start.bat
```

### Le port 3000 est déjà utilisé

Si le serveur ne démarre pas car le port est occupé :

1. Arrêtez le serveur actuel (Ctrl+C)
2. Modifiez `.env` et changez le port :
   ```
   PORT=8080
   ```
3. Relancez `start.bat`
4. Accédez à `http://localhost:8080`

### La page ne charge pas

1. Vérifiez que vous êtes bien sur `http://localhost:3000` (pas `https`)
2. Vérifiez dans la console que le serveur affiche "Interface web: http://localhost:3000"
3. Essayez de rafraîchir la page (F5)

## Tester les fonctionnalités

### Via l'interface web (recommandé)

Cliquez simplement sur les boutons dans l'interface web !

### Via navigateur directement

- Test ping : http://localhost:3000/ping
- Test slow : http://localhost:3000/slow
- Test error : http://localhost:3000/error
- Test debug : http://localhost:3000/debug

### Via ligne de commande (PowerShell)

```powershell
# Test simple
Invoke-WebRequest -Uri http://localhost:3000/ping

# Voir la réponse formatée
(Invoke-WebRequest -Uri http://localhost:3000/ping).Content | ConvertFrom-Json

# Test de charge (10 requêtes)
1..10 | ForEach-Object { Invoke-WebRequest -Uri http://localhost:3000/ping }
```

## Accéder à New Relic

1. Connectez-vous à : https://one.newrelic.com
2. Allez dans **APM & Services**
3. Cliquez sur **tp-realtime-demo**
4. Explorez :
   - **Transactions** : Performance des routes
   - **Errors** : Erreurs capturées
   - **Distributed tracing** : Traces détaillées

## Consulter les logs Winston

Les logs sont enregistrés dans le dossier `logs/` :

```
logs/
├── app-2025-11-07.log       ← Tous les logs
└── error-2025-11-07.log     ← Uniquement les erreurs
```

Pour les voir en temps réel (PowerShell) :

```powershell
Get-Content logs\app-*.log -Wait
```

---

**🎉 C'est tout ! Vous pouvez maintenant tester l'application.**

Pour plus de détails, consultez le [README.md](README.md) complet.


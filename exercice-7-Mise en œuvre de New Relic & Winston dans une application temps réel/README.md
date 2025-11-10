# Exercice 9 - Mise en œuvre de New Relic & Winston

Application de démonstration Node.js avec monitoring New Relic APM et logging avancé Winston.

## 📋 Table des matières

- [Pré-requis](#pré-requis)
- [Installation](#installation)
- [Configuration New Relic](#configuration-new-relic)
- [Démarrage](#démarrage)
- [Utilisation](#utilisation)
- [Fonctionnalités Winston](#fonctionnalités-winston)
- [Observation dans New Relic](#observation-dans-new-relic)
- [Structure du projet](#structure-du-projet)

## 🎯 Pré-requis

- **Node.js** installé (version 14 ou supérieure)
- **Compte New Relic** gratuit (créer un compte sur [https://newrelic.com/signup](https://newrelic.com/signup))
- Connaissances de base en Express.js

## 📦 Installation

### 1. Cloner ou télécharger le projet

```bash
cd exercice-9-Mise\ en\ œuvre\ de\ New\ Relic\ \&\ Winston\ dans\ une\ application\ temps\ réel
```

### 2. Installer les dépendances

```bash
npm install
```

Dépendances installées :
- `express` - Framework web
- `newrelic` - Agent APM New Relic
- `winston` - Logger avancé
- `winston-daily-rotate-file` - Rotation automatique des logs
- `dotenv` - Gestion des variables d'environnement

## 🔑 Configuration New Relic

### Étape 1 : Créer un compte New Relic

1. Rendez-vous sur [https://newrelic.com/signup](https://newrelic.com/signup)
2. Créez un compte gratuit (pas de carte bancaire requise)
3. Confirmez votre email

### Étape 2 : Obtenir votre clé de licence

1. Connectez-vous à votre compte New Relic
2. Cliquez sur votre nom en haut à droite → **API Keys**
3. Copiez votre **License Key** (commence généralement par `eu01xx` ou similaire)

### Étape 3 : Configurer l'application

1. **Copier le fichier d'exemple** :
   ```bash
   cp .env.example .env
   ```

2. **Éditer le fichier `.env`** :
   ```bash
   # Windows
   notepad .env
   
   # Linux/Mac
   nano .env
   ```

3. **Remplacer la clé** par votre vraie clé de licence :
   ```env
   NEW_RELIC_LICENSE_KEY=VOTRE_VRAIE_CLE_ICI
   ```

## 🚀 Démarrage

### Option 1 : Script de démarrage automatique

**Windows** :
```bash
start.bat
```

**Linux/Mac** :
```bash
chmod +x start.sh
./start.sh
```

### Option 2 : Démarrage manuel

```bash
node index.js
```

Le serveur démarre sur **http://localhost:3000**

## 🌐 Interface Web

Une fois le serveur démarré, ouvrez votre navigateur et accédez à :

**👉 http://localhost:3000**

Vous verrez une interface web moderne avec :
- ✅ Boutons pour tester chaque route
- ✅ Affichage des résultats en temps réel
- ✅ Test de charge intégré
- ✅ Visualisation des logs récents
- ✅ Compteur de requêtes

## 🎮 Utilisation

### Interface Web (Recommandé)

Utilisez l'interface web à **http://localhost:3000** pour tester facilement toutes les fonctionnalités.

### Routes API (via cURL ou interface web)

#### 1. `/ping` - Route de test simple

```bash
curl http://localhost:3000/ping
```

**Réponse** :
```json
{
  "message": "pong",
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

**Logs générés** : niveau `info`

---

#### 2. `/slow` - Simulation de latence

```bash
curl http://localhost:3000/slow
```

Simule un endpoint lent avec un délai de **2 secondes**.

**Réponse** :
```json
{
  "status": "ok",
  "duration": "2001ms",
  "message": "Cette requête a pris 2 secondes"
}
```

**Logs générés** : niveau `warn` + `info`

**📊 À observer dans New Relic** : Spike de latence visible dans APM → Transactions

---

#### 3. `/error` - Génération d'erreur

```bash
curl http://localhost:3000/error
```

Génère une erreur intentionnelle pour tester la capture d'erreurs.

**Réponse** :
```json
{
  "error": "Internal Server Error",
  "message": "Boom! Cette erreur est intentionnelle pour tester New Relic",
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

**Logs générés** : niveau `error`

**📊 À observer dans New Relic** : 
- APM → Errors inbox
- Stack trace complète

---

#### 4. `/debug` - Logs de débogage détaillés

```bash
curl http://localhost:3000/debug
```

Génère plusieurs logs de niveau `debug` avec informations système détaillées.

**Réponse** :
```json
{
  "message": "Debug information logged",
  "checkLogs": "Consultez les logs pour voir les informations détaillées",
  "logLevel": "debug"
}
```

**Logs générés** : niveau `debug` avec headers, query params, info système

---

### Générer du trafic pour les tests

**Requêtes multiples** (Linux/Mac) :
```bash
for i in {1..50}; do curl http://localhost:3000/ping; done
```

**Requêtes multiples** (Windows PowerShell) :
```powershell
1..50 | ForEach-Object { Invoke-WebRequest -Uri http://localhost:3000/ping }
```

**Mix de toutes les routes** :
```bash
# Linux/Mac
for i in {1..10}; do
  curl http://localhost:3000/ping
  curl http://localhost:3000/debug
  curl http://localhost:3000/slow
  curl http://localhost:3000/error
done
```

## 📝 Fonctionnalités Winston

### Niveaux de log

L'application utilise 4 niveaux de log :

| Niveau  | Usage                                    | Couleur Console |
|---------|------------------------------------------|-----------------|
| `error` | Erreurs critiques                        | Rouge           |
| `warn`  | Avertissements (latence, etc.)           | Jaune           |
| `info`  | Informations générales                   | Vert            |
| `debug` | Détails pour le débogage                 | Bleu            |

### Fichiers de log

Les logs sont automatiquement écrits dans le dossier `logs/` :

1. **`logs/app-YYYY-MM-DD.log`** - Tous les logs combinés
2. **`logs/error-YYYY-MM-DD.log`** - Uniquement les erreurs

### Rotation automatique

- **Fréquence** : Quotidienne (un nouveau fichier par jour)
- **Taille max** : 20 MB par fichier
- **Conservation** : 14 jours
- **Format** : JSON avec timestamp

### Consulter les logs

**Temps réel** (Linux/Mac) :
```bash
tail -f logs/app-*.log
```

**Temps réel** (Windows PowerShell) :
```powershell
Get-Content logs\app-*.log -Wait
```

**Filtrer les erreurs** :
```bash
cat logs/error-*.log | jq
```

## 📊 Observation dans New Relic

### 1. Connexion au Dashboard

1. Connectez-vous à [https://one.newrelic.com](https://one.newrelic.com)
2. Attendez 1-2 minutes après le premier démarrage (ingestion des données)

### 2. APM → Transactions

**Visualiser** :
- **APM & Services** → **tp-realtime-demo**
- Onglet **Transactions**

**Ce que vous verrez** :
- Liste des routes (`/ping`, `/slow`, `/error`, `/debug`)
- Temps de réponse moyen
- Throughput (requêtes/minute)
- Taux d'erreurs

**📈 Test** : Appelez `/slow` plusieurs fois → observez le spike de latence

### 3. APM → Errors

**Visualiser** :
- **APM & Services** → **tp-realtime-demo**
- Onglet **Errors inbox**

**Ce que vous verrez** :
- Liste des erreurs capturées
- Stack traces complètes
- Contexte de la requête

**🔴 Test** : Appelez `/error` → observez l'erreur apparaître dans New Relic

### 4. Distributed Tracing

**Visualiser** :
- **APM & Services** → **tp-realtime-demo**
- Onglet **Distributed tracing**

**Ce que vous verrez** :
- Trace complète de chaque requête
- Temps passé dans chaque segment
- Waterfall des appels

### 5. Logs (si activé)

**Visualiser** :
- **Logs** dans le menu principal

**Ce que vous verrez** :
- Logs Winston forwarded vers New Relic
- Corrélation automatique avec les traces
- Recherche et filtrage avancés

## 📁 Structure du projet

```
exercice-9/
├── index.js                 # Point d'entrée principal avec routes Express
├── logger.js                # Configuration Winston (couleurs, rotation)
├── newrelic.js              # Configuration New Relic APM
├── package.json             # Dépendances
├── .env.example             # Template variables d'environnement
├── .env                     # Variables d'environnement (non versionné)
├── .gitignore               # Fichiers à ignorer
├── start.sh                 # Script de démarrage Linux/Mac
├── start.bat                # Script de démarrage Windows
├── logs/                    # Logs générés par Winston
│   ├── app-YYYY-MM-DD.log   # Logs combinés avec rotation
│   └── error-YYYY-MM-DD.log # Logs d'erreurs avec rotation
└── README.md                # Cette documentation
```

## 🔧 Configuration avancée

### Changer le niveau de log

Éditez `.env` :
```env
# Production : moins de logs
LOG_LEVEL=info

# Développement : tous les logs
LOG_LEVEL=debug
```

### Changer le port

Éditez `.env` :
```env
PORT=8080
```

### Désactiver New Relic temporairement

Commentez ou supprimez la ligne dans `.env` :
```env
# NEW_RELIC_LICENSE_KEY=...
```

## 🧪 Tests recommandés

### Test 1 : Monitoring de base
```bash
# Générer du trafic
for i in {1..30}; do curl http://localhost:3000/ping; sleep 1; done

# Observer dans New Relic :
# - APM → Transactions → /ping
# - Throughput : ~1 req/sec
```

### Test 2 : Latence
```bash
# Appeler l'endpoint lent
curl http://localhost:3000/slow

# Observer dans New Relic :
# - APM → Transactions → /slow
# - Temps de réponse : ~2000ms
```

### Test 3 : Gestion d'erreurs
```bash
# Générer des erreurs
for i in {1..5}; do curl http://localhost:3000/error; done

# Observer dans New Relic :
# - APM → Errors inbox
# - 5 erreurs avec stack traces
```

### Test 4 : Logs Winston
```bash
# Générer des logs de tous niveaux
curl http://localhost:3000/debug
curl http://localhost:3000/ping
curl http://localhost:3000/slow
curl http://localhost:3000/error

# Consulter les logs :
cat logs/app-*.log | tail -20
```

## 🎓 Points clés à retenir

### New Relic

1. **Import en premier** : `require('newrelic')` doit être la première ligne
2. **Délai d'ingestion** : Attendre 1-2 minutes pour voir les données
3. **License Key** : Obligatoire pour l'envoi des données
4. **APM gratuit** : 100 GB de données/mois inclus

### Winston

1. **Niveaux hiérarchiques** : `error` < `warn` < `info` < `debug`
2. **Rotation automatique** : Évite les fichiers trop volumineux
3. **Format JSON** : Facilite le parsing et l'analyse
4. **Console colorisée** : Meilleure lisibilité en développement

### Bonnes pratiques

1. **Logs structurés** : Toujours inclure du contexte (route, timestamp, etc.)
2. **Niveaux appropriés** : 
   - `debug` : détails pour développeurs
   - `info` : opérations normales
   - `warn` : situations anormales mais gérables
   - `error` : erreurs nécessitant attention
3. **Monitoring continu** : Vérifier New Relic régulièrement en production

## 🐛 Dépannage

### L'application ne démarre pas

**Problème** : `Error: Cannot find module 'newrelic'`

**Solution** :
```bash
npm install
```

---

**Problème** : `License key is required`

**Solution** : Vérifiez que `.env` contient `NEW_RELIC_LICENSE_KEY=...`

---

### Pas de données dans New Relic

**Problème** : Dashboard vide après 5 minutes

**Solutions** :
1. Vérifier que la license key est correcte dans `.env`
2. Vérifier les logs : `newrelic_agent.log` (erreurs d'authentification)
3. Générer plus de trafic (au moins 10-20 requêtes)
4. Vérifier la connexion internet

---

### Logs non créés

**Problème** : Dossier `logs/` vide

**Solutions** :
1. Vérifier que le dossier existe : `mkdir logs`
2. Vérifier les permissions en écriture
3. Consulter la console (logs y apparaissent toujours)

## 📚 Ressources

- [Documentation New Relic Node.js](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/)
- [Documentation Winston](https://github.com/winstonjs/winston)
- [Configuration New Relic](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/)
- [Best Practices Logging](https://github.com/winstonjs/winston#usage)

## ✅ Objectifs de l'exercice

- [x] Installer et configurer New Relic APM
- [x] Mettre en place Winston avec rotation de fichiers
- [x] Créer des routes de test (ping, slow, error, debug)
- [x] Observer les transactions dans New Relic
- [x] Capturer et analyser les erreurs
- [x] Générer et consulter des logs structurés
- [x] Comprendre l'impact de la latence sur le monitoring

---

**🎉 Félicitations !** Vous avez maintenant une application instrumentée avec monitoring APM et logging professionnel.


@echo off
REM Script de démarrage pour Windows
REM Ce script charge les variables d'environnement et démarre l'application

echo.
echo 🚀 Démarrage de l'application New Relic + Winston...
echo.

REM Vérifier si le fichier .env existe
if not exist .env (
    echo ⚠️  Fichier .env non trouvé
    echo 📝 Création du fichier .env depuis .env.example...
    copy .env.example .env
    echo ✓ Fichier .env créé
    echo.
    echo ⚠️  IMPORTANT: Modifiez le fichier .env avec votre clé New Relic
    echo    Éditez le fichier .env et remplacez NEW_RELIC_LICENSE_KEY par votre vraie clé
    echo.
)

REM Vérifier si node_modules existe
if not exist node_modules (
    echo 📦 Installation des dépendances...
    call npm install
    echo ✓ Dépendances installées
    echo.
)

REM Créer le dossier logs s'il n'existe pas
if not exist logs (
    mkdir logs
    echo ✓ Dossier logs créé
    echo.
)

REM Démarrer l'application
echo 🎯 Lancement du serveur...
echo.
node index.js


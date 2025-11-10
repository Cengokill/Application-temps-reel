#!/bin/bash

# Script de démarrage pour Linux/Mac
# Ce script charge les variables d'environnement et démarre l'application

echo "🚀 Démarrage de l'application New Relic + Winston..."
echo ""

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env non trouvé"
    echo "📝 Création du fichier .env depuis .env.example..."
    cp .env.example .env
    echo "✓ Fichier .env créé"
    echo ""
    echo "⚠️  IMPORTANT: Modifiez le fichier .env avec votre clé New Relic"
    echo "   Éditez le fichier .env et remplacez NEW_RELIC_LICENSE_KEY par votre vraie clé"
    echo ""
fi

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo "✓ Dépendances installées"
    echo ""
fi

# Créer le dossier logs s'il n'existe pas
if [ ! -d "logs" ]; then
    mkdir logs
    echo "✓ Dossier logs créé"
    echo ""
fi

# Démarrer l'application
echo "🎯 Lancement du serveur..."
echo ""
node index.js


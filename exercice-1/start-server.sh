#!/bin/bash

# Script de démarrage rapide pour l'application de cotations boursières
echo "🚀 Démarrage de l'application Cotations Boursières Temps Réel"
echo ""

# Vérifier si nous sommes dans le bon répertoire
if [ ! -d "server" ]; then
    echo "❌ Erreur: Le dossier 'server' n'existe pas. Veuillez exécuter ce script depuis la racine du projet."
    exit 1
fi

# Aller dans le dossier server
cd server

# Installer les dépendances si node_modules n'existe pas
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances"
        exit 1
    fi
fi

echo "🔧 Démarrage du serveur SSE..."
echo "📊 L'interface sera accessible sur: http://localhost:3000"
echo "💡 Appuyez sur Ctrl+C pour arrêter le serveur"
echo ""

# Démarrer le serveur
npm start

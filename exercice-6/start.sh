#!/bin/bash

# Script de démarrage pour l'application de tableau de bord collaboratif
echo "🚀 Démarrage de l'application de tableau de bord collaboratif..."

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/"
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé. Il devrait être inclus avec Node.js."
    exit 1
fi

# Installer les dépendances si node_modules n'existe pas
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances"
        exit 1
    fi
fi

# Démarrer le serveur
echo "🌐 Démarrage du serveur (port automatique si 3000 occupé)"
echo "💡 Appuyez sur Ctrl+C pour arrêter le serveur"
echo ""

npm start

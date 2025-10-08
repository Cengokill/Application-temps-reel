#!/bin/bash

echo "🚀 Démarrage du serveur de chat Socket.io (mode sans Redis)"
echo "==========================================================="

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Installer les dépendances si node_modules n'existe pas
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Vérifier si le port 3000 est déjà utilisé
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Le port 3000 est déjà utilisé."
    echo "🔄 Arrêt du processus existant..."
    pkill -f "node server.js" 2>/dev/null || true
    sleep 2
fi

echo "🔧 Démarrage du serveur sur le port 3000..."
echo "🌐 Ouvrez votre navigateur et allez sur: http://localhost:3000"
echo "📱 Ou ouvrez directement le fichier client.html dans votre navigateur"
echo ""
echo "⚠️  Mode SANS Redis - Les messages resteront locaux à cette instance"
echo "💡 Pour tester Redis Pub/Sub, installez et démarrez Docker Desktop"
echo ""
echo "Pour arrêter le serveur, appuyez sur Ctrl+C"
echo "=============================================="

# Démarrer le serveur SANS Redis
REDIS_URL="" node server.js

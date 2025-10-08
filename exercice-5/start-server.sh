#!/bin/bash

echo "🚀 Démarrage du serveur de chat Socket.io avec Redis Pub/Sub..."
echo "================================================================="

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez l'installer d'abord."
    echo "💡 Instructions: https://docs.docker.com/get-docker/"
    exit 1
fi

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

# Vérifier si Redis est déjà en cours d'exécution
if docker ps | grep -q "my-redis"; then
    echo "✅ Redis est déjà en cours d'exécution."
else
    echo "🐳 Démarrage de Redis avec Docker..."

    # Arrêter et supprimer le conteneur existant s'il existe
    docker stop my-redis 2>/dev/null || true
    docker rm my-redis 2>/dev/null || true

    # Lancer Redis
    docker run --name my-redis -p 6379:6379 -d redis/redis-stack-server:latest

    if [ $? -eq 0 ]; then
        echo "✅ Redis démarré avec succès sur le port 6379"
        sleep 3  # Attendre que Redis soit prêt
    else
        echo "❌ Erreur lors du démarrage de Redis"
        exit 1
    fi
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
echo "ℹ️  Redis Pub/Sub activé pour la synchronisation multi-instances"
echo "ℹ️  Pour tester plusieurs instances, lancez: node server.js 3001"
echo ""
echo "Pour arrêter le serveur, appuyez sur Ctrl+C"
echo "=============================================="

# Démarrer le serveur
node server.js

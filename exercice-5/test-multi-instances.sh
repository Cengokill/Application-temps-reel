#!/bin/bash

echo "🧪 Test multi-instances du chat avec Redis Pub/Sub"
echo "=================================================="

# Fonction pour vérifier si un port est utilisé
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port utilisé
    else
        return 1  # Port libre
    fi
}

# Fonction pour tuer les processus sur un port
kill_port() {
    if check_port $1; then
        echo "🔄 Arrêt du processus sur le port $1..."
        pkill -f "node server.js $1" 2>/dev/null || true
        sleep 1
    fi
}

# Vérifier les prérequis
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    exit 1
fi

# Nettoyer les instances existantes
echo "🧹 Nettoyage des instances existantes..."
kill_port 3000
kill_port 3001
kill_port 3002

# Démarrer Redis si nécessaire
if ! docker ps | grep -q "my-redis"; then
    echo "🐳 Démarrage de Redis..."
    docker stop my-redis 2>/dev/null || true
    docker rm my-redis 2>/dev/null || true
    docker run --name my-redis -p 6379:6379 -d redis/redis-stack-server:latest
    sleep 3
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

echo ""
echo "🚀 Démarrage de 3 instances de serveur..."
echo ""

# Démarrer l'instance 1 (port 3000) en arrière-plan
echo "📡 Instance 1 démarrée sur http://localhost:3000"
node server.js 3000 &
PID1=$!

# Attendre un peu et démarrer l'instance 2 (port 3001)
sleep 2
echo "📡 Instance 2 démarrée sur http://localhost:3001"
node server.js 3001 &
PID2=$!

# Attendre un peu et démarrer l'instance 3 (port 3002)
sleep 2
echo "📡 Instance 3 démarrée sur http://localhost:3002"
node server.js 3002 &
PID3=$!

echo ""
echo "✅ Toutes les instances sont démarrées !"
echo ""
echo "🖥️  Ouvrez vos navigateurs sur :"
echo "   • http://localhost:3000 (Instance 1)"
echo "   • http://localhost:3001 (Instance 2)"
echo "   • http://localhost:3002 (Instance 3)"
echo ""
echo "💬 Testez en envoyant des messages depuis différentes instances"
echo "   Tous les messages devraient apparaître dans toutes les instances !"
echo ""
echo "🛑 Pour arrêter toutes les instances, appuyez sur Ctrl+C"
echo ""

# Fonction de nettoyage lors de l'arrêt
cleanup() {
    echo ""
    echo "🛑 Arrêt de toutes les instances..."
    kill $PID1 2>/dev/null || true
    kill $PID2 2>/dev/null || true
    kill $PID3 2>/dev/null || true
    echo "✅ Instances arrêtées"
    exit 0
}

# Capturer le signal d'arrêt (Ctrl+C)
trap cleanup SIGINT SIGTERM

# Attendre indéfiniment
wait

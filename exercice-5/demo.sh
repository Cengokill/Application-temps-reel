#!/bin/bash

echo "🎯 Démonstration de l'application Chat avec Redis Pub/Sub"
echo "======================================================="
echo ""
echo "Cette démonstration va vous montrer comment :"
echo "1. Lancer Redis automatiquement avec Docker"
echo "2. Démarrer plusieurs instances de serveur"
echo "3. Tester la synchronisation des messages"
echo ""
echo "Prérequis : Docker doit être installé et en cours d'exécution"
echo ""

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé."
    echo "💡 Installez Docker depuis : https://docs.docker.com/get-docker/"
    exit 1
fi

# Vérifier si Docker daemon fonctionne
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon n'est pas en cours d'exécution."
    echo "💡 Démarrez Docker Desktop ou le service Docker."
    exit 1
fi

echo "✅ Docker est disponible"
echo ""

# Étape 1: Nettoyer
echo "🧹 Nettoyage des instances précédentes..."
pkill -f "node server.js" 2>/dev/null || true
docker stop my-redis 2>/dev/null || true
docker rm my-redis 2>/dev/null || true
sleep 2

# Étape 2: Lancer Redis
echo "🐳 Étape 1: Démarrage de Redis avec Docker..."
docker run --name my-redis -p 6379:6379 -d redis/redis-stack-server:latest

if [ $? -eq 0 ]; then
    echo "✅ Redis démarré sur le port 6379"
else
    echo "❌ Erreur lors du démarrage de Redis"
    exit 1
fi

sleep 3

# Étape 3: Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances Node.js..."
    npm install
fi

# Étape 4: Lancer la première instance
echo ""
echo "🚀 Étape 2: Démarrage de l'Instance 1 (port 3000)..."
node server.js 3000 &
PID1=$!
sleep 2

# Étape 5: Lancer la deuxième instance
echo "🚀 Étape 3: Démarrage de l'Instance 2 (port 3001)..."
node server.js 3001 &
PID2=$!
sleep 2

echo ""
echo "🎉 Démonstration prête !"
echo ""
echo "📱 Ouvrez vos navigateurs sur :"
echo "   • http://localhost:3000 (Instance 1)"
echo "   • http://localhost:3001 (Instance 2)"
echo ""
echo "💬 Instructions de test :"
echo "   1. Connectez-vous avec des pseudos différents sur chaque instance"
echo "   2. Envoyez des messages depuis l'Instance 1"
echo "   3. Vérifiez qu'ils apparaissent dans l'Instance 2"
echo "   4. Répondez depuis l'Instance 2"
echo "   5. Vérifiez la synchronisation bidirectionnelle"
echo ""
echo "🛑 Pour arrêter la démonstration, appuyez sur Ctrl+C"
echo ""

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "🛑 Arrêt de la démonstration..."
    kill $PID1 2>/dev/null || true
    kill $PID2 2>/dev/null || true
    docker stop my-redis 2>/dev/null || true
    docker rm my-redis 2>/dev/null || true
    echo "✅ Démonstration terminée"
    exit 0
}

# Capturer Ctrl+C
trap cleanup SIGINT SIGTERM

# Attendre
wait

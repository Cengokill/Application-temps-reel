#!/bin/bash

echo "🛑 Arrêt du serveur de chat..."
echo "=============================="

# Chercher et arrêter le processus du serveur
if pgrep -f "node server.js" > /dev/null; then
    echo "🔍 Serveur trouvé, arrêt en cours..."
    pkill -f "node server.js"
    sleep 2
    
    # Vérifier si l'arrêt a réussi
    if pgrep -f "node server.js" > /dev/null; then
        echo "⚠️  Arrêt forcé nécessaire..."
        pkill -9 -f "node server.js"
        sleep 1
    fi
    
    echo "✅ Serveur arrêté avec succès"
else
    echo "ℹ️  Aucun serveur en cours d'exécution"
fi

# Vérifier le port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Le port 3000 est encore occupé"
    echo "💡 Vous pouvez forcer l'arrêt avec: sudo lsof -ti:3000 | xargs kill -9"
else
    echo "✅ Le port 3000 est libre"
fi

echo "=============================="

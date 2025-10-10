#!/bin/bash

# Script de démarrage pour l'Éditeur Collaboratif Temps Réel
# Démarre Redis et le serveur Node.js

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_PORT=3000
REDIS_PORT=6379
REDIS_CONTAINER_NAME="editeur-collaboratif-redis"

echo -e "${BLUE}🚀 Démarrage de l'Éditeur Collaboratif Temps Réel${NC}"
echo "=================================================="

# Fonction pour vérifier si un port est utilisé
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port utilisé
    else
        return 1  # Port libre
    fi
}

# Fonction pour arrêter Redis
cleanup_redis() {
    echo -e "\n${YELLOW}🛑 Arrêt de Redis...${NC}"
    if docker ps -q -f name=$REDIS_CONTAINER_NAME | grep -q .; then
        docker stop $REDIS_CONTAINER_NAME >/dev/null 2>&1
        docker rm $REDIS_CONTAINER_NAME >/dev/null 2>&1
        echo -e "${GREEN}✅ Redis arrêté${NC}"
    fi
}

# Gestion de l'arrêt propre
trap cleanup_redis EXIT INT TERM

# Vérifier les prérequis
echo -e "${BLUE}📋 Vérification des prérequis...${NC}"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "💡 Installez Node.js depuis https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm $NPM_VERSION${NC}"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️ Docker n'est pas installé${NC}"
    echo "💡 L'application fonctionnera sans Redis (mode local uniquement)"
    USE_REDIS=false
else
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✅ $DOCKER_VERSION${NC}"
    USE_REDIS=true
fi

# Vérifier les ports
echo -e "\n${BLUE}🔍 Vérification des ports...${NC}"

if check_port $SERVER_PORT; then
    echo -e "${RED}❌ Le port $SERVER_PORT est déjà utilisé${NC}"
    echo "💡 Arrêtez le processus existant ou changez le port"
    exit 1
fi
echo -e "${GREEN}✅ Port $SERVER_PORT libre${NC}"

if check_port $REDIS_PORT; then
    echo -e "${YELLOW}⚠️ Le port $REDIS_PORT est déjà utilisé${NC}"
    echo "💡 Redis local détecté, utilisation du Redis existant"
    USE_REDIS=false
else
    echo -e "${GREEN}✅ Port $REDIS_PORT libre${NC}"
fi

# Installation des dépendances
echo -e "\n${BLUE}📦 Installation des dépendances...${NC}"

if [ ! -d "server/node_modules" ]; then
    echo "Installation des dépendances du serveur..."
    cd server
    npm install
    cd ..
    echo -e "${GREEN}✅ Dépendances installées${NC}"
else
    echo -e "${GREEN}✅ Dépendances déjà installées${NC}"
fi

# Démarrage de Redis
if [ "$USE_REDIS" = true ]; then
    echo -e "\n${BLUE}🔴 Démarrage de Redis...${NC}"
    
    # Arrêter Redis existant s'il y en a un
    if docker ps -q -f name=$REDIS_CONTAINER_NAME | grep -q .; then
        echo "Arrêt de Redis existant..."
        docker stop $REDIS_CONTAINER_NAME >/dev/null 2>&1
        docker rm $REDIS_CONTAINER_NAME >/dev/null 2>&1
    fi
    
    # Démarrer Redis
    docker run -d \
        --name $REDIS_CONTAINER_NAME \
        -p $REDIS_PORT:$REDIS_PORT \
        redis:alpine \
        redis-server --appendonly yes
    
    # Attendre que Redis soit prêt
    echo "Attente du démarrage de Redis..."
    sleep 3
    
    # Vérifier que Redis fonctionne
    if docker exec $REDIS_CONTAINER_NAME redis-cli ping | grep -q "PONG"; then
        echo -e "${GREEN}✅ Redis démarré avec succès${NC}"
    else
        echo -e "${RED}❌ Erreur lors du démarrage de Redis${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ Redis non utilisé (mode local uniquement)${NC}"
fi

# Démarrage du serveur
echo -e "\n${BLUE}🚀 Démarrage du serveur...${NC}"

cd server

# Variables d'environnement
export PORT=$SERVER_PORT
export REDIS_URL="redis://localhost:$REDIS_PORT"
export EDITOR_TOKEN="secret123"

echo "Configuration:"
echo "  Port: $PORT"
echo "  Redis: $REDIS_URL"
echo "  Token: $EDITOR_TOKEN"

echo -e "\n${GREEN}🌐 Serveur démarré !${NC}"
echo "=================================================="
echo -e "${BLUE}📱 Interface principale:${NC} http://localhost:$SERVER_PORT/client/index.html"
echo -e "${BLUE}📊 Monitoring:${NC} http://localhost:$SERVER_PORT/monitor"
echo -e "${BLUE}🔑 Token d'authentification:${NC} $EDITOR_TOKEN"
echo "=================================================="
echo -e "${YELLOW}💡 Appuyez sur Ctrl+C pour arrêter le serveur${NC}"
echo ""

# Démarrer le serveur
npm start

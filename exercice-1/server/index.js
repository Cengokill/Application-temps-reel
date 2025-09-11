/**
 * Serveur SSE pour la diffusion de cotations boursières fictives en temps réel
 * Génère des prix aléatoires pour 5 actions et les diffuse via Server-Sent Events
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Liste des actions fictives
const STOCKS = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA'];

// Prix actuels pour chaque action
let currentStockPrices = {
  AAPL: 226.00,
  GOOGL: 2800.00,
  MSFT: 500.00,
  TSLA: 347.00,
  AMZN: 230.00,
  NVDA: 177.00
};

// Configuration optimisée de l'historique
const HISTORY_CONFIG = {
  SHORT_TERM: 100,    // Dernières 100 valeurs (haute résolution)
  MEDIUM_TERM: 500,   // Toutes les 5 valeurs (moyenne résolution)
  LONG_TERM: 1000     // Toutes les 20 valeurs (basse résolution)
};

// Historique optimisé avec échantillonnage
let priceHistory = {
  AAPL: { short: [], medium: [], long: [], counters: { medium: 0, long: 0 } },
  GOOGL: { short: [], medium: [], long: [], counters: { medium: 0, long: 0 } },
  MSFT: { short: [], medium: [], long: [], counters: { medium: 0, long: 0 } },
  TSLA: { short: [], medium: [], long: [], counters: { medium: 0, long: 0 } },
  AMZN: { short: [], medium: [], long: [], counters: { medium: 0, long: 0 } },
  NVDA: { short: [], medium: [], long: [], counters: { medium: 0, long: 0 } }
};

// Initialiser l'historique avec les prix actuels
Object.keys(currentStockPrices).forEach(symbol => {
  const price = currentStockPrices[symbol];
  priceHistory[symbol].short = Array(HISTORY_CONFIG.SHORT_TERM).fill(price);
  priceHistory[symbol].medium = Array(HISTORY_CONFIG.MEDIUM_TERM).fill(price);
  priceHistory[symbol].long = Array(HISTORY_CONFIG.LONG_TERM).fill(price);
});

/**
 * Met à jour l'historique optimisé avec échantillonnage
 * @param {string} symbol - Symbole de l'action
 * @param {number} newPrice - Nouveau prix
 */
function updateOptimizedHistory(symbol, newPrice) {
  const history = priceHistory[symbol];

  // Court terme : toujours ajouter (haute résolution)
  history.short.push(newPrice);
  if (history.short.length > HISTORY_CONFIG.SHORT_TERM) {
    history.short.shift();
  }

  // Moyen terme : ajouter toutes les 5 valeurs
  history.counters.medium++;
  if (history.counters.medium >= 5) {
    history.medium.push(newPrice);
    if (history.medium.length > HISTORY_CONFIG.MEDIUM_TERM) {
      history.medium.shift();
    }
    history.counters.medium = 0;
  }

  // Long terme : ajouter toutes les 20 valeurs
  history.counters.long++;
  if (history.counters.long >= 20) {
    history.long.push(newPrice);
    if (history.long.length > HISTORY_CONFIG.LONG_TERM) {
      history.long.shift();
    }
    history.counters.long = 0;
  }
}

/**
 * Combine les historiques pour créer une série complète optimisée
 * @param {string} symbol - Symbole de l'action
 * @returns {Array} Historique combiné optimisé
 */
function getOptimizedHistory(symbol) {
  const history = priceHistory[symbol];
  return [...history.long, ...history.medium.slice(-50), ...history.short.slice(-20)];
}

/**
 * Génère une mise à jour aléatoire pour une action
 * @returns {Object} Données de l'action mise à jour
 */
function generateStockUpdate() {
  // Choisit une action aléatoirement
  const symbol = STOCKS[Math.floor(Math.random() * STOCKS.length)];
  const currentPrice = currentStockPrices[symbol];

  // Simule une variation de prix
  const changePercent = (Math.random() - 0.5) / 100; // +/- 0.5%
  const newPrice = currentPrice * (1 + changePercent);
  const roundedNewPrice = Math.round(newPrice * 100) / 100; // Arrondit à 2 décimales

  // Met à jour le prix pour la prochaine itération
  currentStockPrices[symbol] = roundedNewPrice;

  // Met à jour l'historique optimisé
  updateOptimizedHistory(symbol, roundedNewPrice);

  // Calcule le changement réel
  const change = Math.round((roundedNewPrice - currentPrice) * 100) / 100;

  // Retourne les données avec historique récent pour les sparklines
  const recentHistory = priceHistory[symbol].short.slice(-20); // 20 dernières valeurs

  return {
    symbol: symbol,
    price: roundedNewPrice,
    change: change,
    timestamp: new Date().toISOString(),
    history: recentHistory // Ajout de l'historique pour les sparklines
  };
}

// Middlewares
app.use(cors());
app.use(express.json());

// Sert les fichiers statiques (HTML, CSS, JS)
app.use(express.static('public'));

// Route principale
app.get('/', (req, res) => {
  res.json({
    message: 'Serveur SSE de cotations boursières',
    endpoint: '/api/stocks/sse'
  });
});

// Endpoint pour récupérer l'historique optimisé d'une action
app.get('/api/stocks/:symbol/history', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  if (!STOCKS.includes(symbol)) {
    return res.status(404).json({ error: 'Action non trouvée' });
  }

  const optimizedHistory = getOptimizedHistory(symbol);
  const totalPoints = optimizedHistory.length;

  res.json({
    symbol: symbol,
    currentPrice: currentStockPrices[symbol],
    history: optimizedHistory,
    timestamps: Array.from({length: totalPoints}, (_, i) =>
      new Date(Date.now() - (totalPoints - 1 - i) * 1000).toISOString()
    ),
    metadata: {
      totalPoints: totalPoints,
      shortTermPoints: HISTORY_CONFIG.SHORT_TERM,
      mediumTermPoints: HISTORY_CONFIG.MEDIUM_TERM,
      longTermPoints: HISTORY_CONFIG.LONG_TERM
    }
  });
});

// Endpoint pour récupérer toutes les données actuelles (optimisé)
app.get('/api/stocks', (req, res) => {
  const allStocks = STOCKS.map(symbol => ({
    symbol: symbol,
    price: currentStockPrices[symbol],
    history: priceHistory[symbol].short.slice(-20), // Seulement les 20 dernières valeurs haute résolution
    timestamp: new Date().toISOString()
  }));

  res.json(allStocks);
});

/**
 * Endpoint SSE pour la diffusion des cotations
 * Suit exactement la structure Python avec générateur infini
 */
app.get('/api/stocks/sse', (req, res) => {
  connectionCount++;
  console.log(`📡 Nouvelle connexion SSE (${connectionCount} actives)`);

  // Configuration des headers SSE (comme en Python)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'X-Accel-Buffering': 'no' // Important pour les proxies
  });

  // Fonction pour envoyer les données
  const sendData = () => {
    try {
      const stockData = generateStockUpdate();
      dataPointsSent++;
      // Format SSE identique : data: <json>\n\n
      res.write(`data: ${JSON.stringify(stockData)}\n\n`);
    } catch (error) {
      console.error('Erreur lors de la génération des données:', error);
    }
  };

  // Envoi initial (comme en Python, pas d'envoi initial explicite mais on peut le garder)
  sendData();

  // Envoi périodique toutes les 2 secondes (optimisé pour les performances)
  const interval = setInterval(sendData, 2000);

  // Gestion de la fermeture de la connexion
  req.on('close', () => {
    connectionCount--;
    clearInterval(interval);
    res.end();
  });

  // Gestion des erreurs
  req.on('error', (err) => {
    connectionCount--;
    console.error('Erreur SSE:', err);
    clearInterval(interval);
    res.end();
  });
});

// Monitoring des performances
let connectionCount = 0;
let dataPointsSent = 0;

setInterval(() => {
  console.log(`📊 Stats: ${connectionCount} connexions actives, ${dataPointsSent} points de données envoyés`);
}, 60000); // Toutes les minutes

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur SSE optimisé démarré sur http://localhost:${PORT}`);
  console.log(`📊 Endpoint SSE: http://localhost:${PORT}/api/stocks/sse`);
  console.log(`⚡ Configuration: ${HISTORY_CONFIG.SHORT_TERM} court terme, ${HISTORY_CONFIG.MEDIUM_TERM} moyen terme, ${HISTORY_CONFIG.LONG_TERM} long terme`);
});

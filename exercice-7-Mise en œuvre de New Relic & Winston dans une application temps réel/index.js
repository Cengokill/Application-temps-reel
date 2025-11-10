/**
 * ⚠️ IMPORTANT : New Relic doit être requis en PREMIER
 * Cela permet à l'agent d'instrumenter tous les modules suivants
 */
require('dotenv').config();
require('newrelic');

const logger = require('./logger');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Servir les fichiers statiques depuis le dossier public
 * 
 * @summary Permet d'accéder à l'interface web via le navigateur
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Middleware de logging pour toutes les requêtes
 * 
 * @summary Log chaque requête HTTP avec méthode, URL et IP
 */
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

/**
 * Route de test basique
 * 
 * @summary Retourne un simple "pong" pour vérifier que l'application fonctionne
 * @route GET /ping
 * @returns {Object} 200 - Message de réponse
 */
app.get('/ping', (req, res) => {
  logger.info('Ping received', { route: '/ping', timestamp: new Date().toISOString() });
  res.json({ 
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

/**
 * Route simulant une latence importante
 * 
 * @summary Simule un endpoint lent avec délai de 2 secondes pour tester le monitoring
 * @route GET /slow
 * @returns {Object} 200 - Statut après délai
 */
app.get('/slow', async (req, res) => {
  const startTime = Date.now();
  logger.warn('Slow endpoint triggered', { 
    route: '/slow',
    expectedDelay: '2000ms'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const duration = Date.now() - startTime;
  logger.info('Slow endpoint completed', { 
    route: '/slow',
    duration: `${duration}ms`
  });
  
  res.json({ 
    status: 'ok',
    duration: `${duration}ms`,
    message: 'Cette requête a pris 2 secondes'
  });
});

/**
 * Route générant une erreur
 * 
 * @summary Provoque une erreur pour tester la capture et le reporting dans New Relic
 * @route GET /error
 * @throws {Error} Erreur intentionnelle
 */
app.get('/error', (req, res) => {
  logger.error('Unexpected error endpoint triggered', { 
    route: '/error',
    intentional: true
  });
  
  // Génération d'une erreur intentionnelle
  throw new Error('Boom! Cette erreur est intentionnelle pour tester New Relic');
});

/**
 * Route de test pour le niveau debug
 * 
 * @summary Génère plusieurs logs de niveau debug avec informations détaillées
 * @route GET /debug
 * @returns {Object} 200 - Informations de débogage
 */
app.get('/debug', (req, res) => {
  logger.debug('Debug endpoint called', {
    route: '/debug',
    headers: req.headers,
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('Environment information', {
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
  
  logger.info('Debug information collected successfully');
  
  res.json({
    message: 'Debug information logged',
    checkLogs: 'Consultez les logs pour voir les informations détaillées',
    logLevel: process.env.LOG_LEVEL || 'debug'
  });
});


/**
 * Middleware de gestion d'erreurs
 * 
 * @summary Capture toutes les erreurs non gérées et les log
 */
app.use((err, req, res, next) => {
  logger.error('Error caught by error handler', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

/**
 * Démarrage du serveur
 */
app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'debug',
    newRelicEnabled: !!process.env.NEW_RELIC_LICENSE_KEY
  });
  
  console.log(`\n✓ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`✓ Interface web: http://localhost:${PORT}`);
  console.log(`✓ New Relic: ${process.env.NEW_RELIC_LICENSE_KEY ? 'Activé' : 'Désactivé'}`);
  console.log(`✓ Log Level: ${process.env.LOG_LEVEL || 'debug'}\n`);
});

/**
 * Gestion de l'arrêt gracieux
 */
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});


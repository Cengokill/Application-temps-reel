/**
 * Module de logging avec Winston
 * Gère les logs de l'application et les métriques de monitoring
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Créer le dossier logs s'il n'existe pas
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

/**
 * Configuration du logger Winston
 * @summary Logger avec sortie console et fichier
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Fichier pour toutes les logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Fichier pour les erreurs uniquement
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Ajouter la sortie console en developpement
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Classe pour gérer les métriques de monitoring
 * @summary Collecte et expose les metriques de l'application
 */
class Metrics {
  constructor() {
    this.activeConnections = 0;
    this.totalConnections = 0;
    this.totalMessages = 0;
    this.errors = 0;
    this.latencies = [];
    this.startTime = Date.now();
    
    // Compte les messages par seconde
    this.messagesPerSecond = 0;
    this.messageCountLastSecond = 0;
    
    // Démarre le compteur messages/seconde
    setInterval(() => {
      this.messagesPerSecond = this.messageCountLastSecond;
      this.messageCountLastSecond = 0;
    }, 1000);
  }

  /**
   * Incremente le nombre de connexions actives
   * @summary Appelé quand un utilisateur se connecte
   */
  connectionOpened() {
    this.activeConnections++;
    this.totalConnections++;
    logger.info('Nouvelle connexion', {
      active: this.activeConnections,
      total: this.totalConnections
    });
  }

  /**
   * Décrémente le nombre de connexions actives
   * @summary Appelé quand un utilisateur se déconnecte
   */
  connectionClosed() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    logger.info('Connexion fermée', {
      active: this.activeConnections
    });
  }

  /**
   * Enregistre un message envoyé
   * @param {string} event - Nom de l'événement
   * @param {number} userId - ID de l'utilisateur
   * @summary Compte les messages et log l'evenement
   */
  messageReceived(event, userId) {
    this.totalMessages++;
    this.messageCountLastSecond++;
    logger.debug('Message reçu', {
      event,
      userId,
      total: this.totalMessages
    });
  }

  /**
   * Enregistre une latence
   * @param {number} latency - Latence en millisecondes
   * @summary Stocke la latence pour calcul de moyennes
   */
  recordLatency(latency) {
    this.latencies.push(latency);
    
    // Garde seulement les 100 dernieres latences
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
  }

  /**
   * Calcule la latence moyenne
   * @returns {number} Latence moyenne en ms
   * @summary Moyenne des dernieres latences enregistrées
   */
  getAverageLatency() {
    if (this.latencies.length === 0) return 0;
    
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencies.length);
  }

  /**
   * Enregistre une erreur
   * @param {Error} error - Objet erreur
   * @param {string} context - Contexte de l'erreur
   * @summary Log l'erreur et incremente le compteur
   */
  recordError(error, context = '') {
    this.errors++;
    logger.error('Erreur détectée', {
      message: error.message,
      context,
      stack: error.stack,
      totalErrors: this.errors
    });
  }

  /**
   * Retourne toutes les métriques
   * @returns {Object} Objet contenant toutes les metriques
   * @summary Vue d'ensemble de l'état de l'application
   */
  getMetrics() {
    return {
      connections: {
        active: this.activeConnections,
        total: this.totalConnections
      },
      messages: {
        total: this.totalMessages,
        perSecond: this.messagesPerSecond
      },
      latency: {
        average: this.getAverageLatency(),
        samples: this.latencies.length
      },
      errors: this.errors,
      uptime: Math.floor((Date.now() - this.startTime) / 1000) // en secondes
    };
  }

  /**
   * Affiche les métriques dans la console
   * @summary Log périodique des metriques principales
   */
  logMetrics() {
    const metrics = this.getMetrics();
    logger.info('Métriques actuelles', metrics);
  }
}

// Instance singleton des métriques
const metrics = new Metrics();

// Log les métriques toutes les 30 secondes
setInterval(() => {
  metrics.logMetrics();
}, 30000);

module.exports = {
  logger,
  metrics
};


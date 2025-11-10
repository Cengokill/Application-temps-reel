const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

/**
 * Configuration du logger Winston avec fonctionnalités avancées
 * 
 * @summary Configure un logger avec niveaux debug, logs colorisés et rotation de fichiers
 * 
 * Fonctionnalités :
 * - Niveaux : error, warn, info, debug
 * - Console colorisée pour développement
 * - Rotation quotidienne des logs (conservation 14 jours, max 20MB)
 * - Fichiers séparés pour erreurs et logs combinés
 */

// Transport pour les logs combinés avec rotation
const combinedRotateTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
  )
});

// Transport pour les erreurs uniquement avec rotation
const errorRotateTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
  )
});

// Transport console avec couleurs
const consoleTransport = new transports.Console({
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      let metaString = '';
      if (Object.keys(meta).length > 0) {
        metaString = ` ${JSON.stringify(meta)}`;
      }
      return `${timestamp} [${level}]: ${message}${metaString}`;
    })
  )
});

// Création du logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    consoleTransport,
    combinedRotateTransport,
    errorRotateTransport
  ]
});

// Événements de rotation
combinedRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { oldFilename, newFilename });
});

errorRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Error log file rotated', { oldFilename, newFilename });
});

module.exports = logger;


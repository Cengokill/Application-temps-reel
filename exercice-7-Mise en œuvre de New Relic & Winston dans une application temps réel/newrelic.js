'use strict'

/**
 * Configuration New Relic APM
 * 
 * @summary Configure l'agent New Relic pour le monitoring de l'application
 * 
 * Cette configuration doit être chargée AVANT tout autre module dans index.js.
 * La clé de licence est récupérée depuis la variable d'environnement NEW_RELIC_LICENSE_KEY.
 */

exports.config = {
  /**
   * Nom de l'application tel qu'il apparaîtra dans New Relic
   */
  app_name: ['tp-realtime-demo'],
  
  /**
   * Clé de licence New Relic (obligatoire)
   * Récupérée depuis variable d'environnement
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY || 'YOUR_LICENSE_KEY_HERE',
  
  /**
   * Niveau de log de l'agent New Relic
   * Options: 'fatal', 'error', 'warn', 'info', 'debug', 'trace'
   */
  logging: {
    level: 'info',
    filepath: 'stdout'
  },
  
  /**
   * Activation du mode audit pour debugging (désactivé en production)
   */
  audit_log: {
    enabled: false
  },
  
  /**
   * Configuration des transactions
   */
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated',
    explain_threshold: 500
  },
  
  /**
   * Configuration de la capture d'erreurs
   */
  error_collector: {
    enabled: true,
    ignore_status_codes: [404]
  },
  
  /**
   * Configuration des attributs
   */
  attributes: {
    enabled: true,
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  },
  
  /**
   * Configuration du distributed tracing
   */
  distributed_tracing: {
    enabled: true
  },
  
  /**
   * Configuration de l'agent pour l'envoi de logs vers New Relic
   */
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    },
    metrics: {
      enabled: true
    },
    local_decorating: {
      enabled: true
    }
  }
}


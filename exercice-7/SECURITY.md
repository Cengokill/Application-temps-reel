# Sécurité - Éditeur Collaboratif Temps Réel

## Résumé des améliorations de sécurité implémentées

### ✅ 1. Validation et sanitisation renforcées

#### Côté serveur (`server/index.js`)
- **validator.js** : Sanitisation stricte de toutes les données entrantes
- **Validation des types** : Vérification des types de données (string, number, object)
- **Validation des longueurs** : Limites strictes (pseudo: 20 chars, éditeur: 50000 chars)
- **Validation des patterns** : Détection de contenu suspect (scripts, événements JS)
- **Échappement HTML** : Protection contre l'injection XSS

```javascript
// Exemple de validation renforcée
function validateEditorData(data) {
    // Validation des types
    if (typeof data.position !== 'number' || data.position < 0) {
        return { valid: false, error: 'Position invalide' };
    }
    
    // Sanitisation du texte
    const sanitizedText = validator.escape(data.text || '');
    
    // Vérification des patterns suspects
    const suspiciousPatterns = [
        /<script/i, /javascript:/i, /on\w+\s*=/i,
        /eval\s*\(/i, /document\./i, /window\./i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(sanitizedText))) {
        return { valid: false, error: 'Contenu suspect détecté' };
    }
    
    return { valid: true, sanitizedData: { ...data, text: sanitizedText } };
}
```

#### Côté client (`client/script.js`)
- **DOMPurify** : Configuration stricte pour nettoyer le HTML
- **Validation des patterns** : Détection de contenu malveillant
- **Validation des caractères** : Restrictions sur les pseudonymes
- **Sanitisation en temps réel** : Nettoyage avant envoi au serveur

```javascript
// Configuration DOMPurify renforcée
const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: [], // Aucun tag HTML autorisé
    ALLOWED_ATTR: [], // Aucun attribut autorisé
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: true
};

// Validation des pseudonymes
const allowedUsernamePattern = /^[a-zA-Z0-9\s\-_\.]+$/;
if (!allowedUsernamePattern.test(sanitizedUsername)) {
    showError('Le pseudonyme ne peut contenir que des lettres, chiffres, espaces, tirets, underscores et points');
    return false;
}
```

### ✅ 2. Rate Limiting et Throttling

#### Côté serveur
- **express-rate-limit** : Limitation des requêtes HTTP par IP
- **Rate limiting custom** : Limitation des événements Socket.IO par socket
- **Helmet** : Headers de sécurité HTTP
- **Détection d'abus** : Seuils configurables pour déclencher la déconnexion

```javascript
// Configuration des limites
const RATE_LIMIT_CONFIG = {
    SOCKET_EVENTS_PER_SECOND: 10,
    SOCKET_EVENTS_PER_MINUTE: 300,
    IP_REQUESTS_PER_MINUTE: 100,
    IP_REQUESTS_PER_HOUR: 1000,
    EDITOR_UPDATES_PER_SECOND: 5,
    CURSOR_UPDATES_PER_SECOND: 20,
    ABUSE_THRESHOLD: 50, // événements/seconde
    ABUSE_WINDOW: 10000  // fenêtre de 10 secondes
};

// Rate limiting Express
const globalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: RATE_LIMIT_CONFIG.IP_REQUESTS_PER_HOUR,
    message: { error: 'Trop de requêtes depuis cette IP' }
});

// Rate limiting Socket.IO
function checkSocketRateLimit(socketId, eventType) {
    const counters = socketEventCounters.get(socketId) || { events: [], lastCleanup: Date.now() };
    const recentEvents = counters.events.filter(timestamp => timestamp > Date.now() - 1000);
    
    let limit = RATE_LIMIT_CONFIG.SOCKET_EVENTS_PER_SECOND;
    if (eventType === 'editor_update') limit = RATE_LIMIT_CONFIG.EDITOR_UPDATES_PER_SECOND;
    if (eventType === 'cursor_position') limit = RATE_LIMIT_CONFIG.CURSOR_UPDATES_PER_SECOND;
    
    if (recentEvents.length > limit) {
        console.warn(`⚠️ Rate limit dépassé pour socket ${socketId}: ${recentEvents.length}/${limit}`);
        return false;
    }
    
    return true;
}
```

#### Côté client
- **Throttling préventif** : Limitation des événements avant envoi
- **Limites plus strictes** : 3 mises à jour éditeur/seconde, 15 curseurs/seconde
- **Nettoyage automatique** : Suppression des anciens compteurs

```javascript
// Limites côté client (plus strictes que le serveur)
const CLIENT_RATE_LIMITS = {
    EDITOR_UPDATES_PER_SECOND: 3,
    CURSOR_UPDATES_PER_SECOND: 15,
    CLEANUP_INTERVAL: 1000
};

// Vérification avant envoi
function canSendEvent(eventType) {
    const now = Date.now();
    cleanupClientEventCounters();
    
    let limit, counter;
    switch (eventType) {
        case 'editor_update':
            limit = CLIENT_RATE_LIMITS.EDITOR_UPDATES_PER_SECOND;
            counter = clientEventCounters.editorUpdates;
            break;
        case 'cursor_position':
            limit = CLIENT_RATE_LIMITS.CURSOR_UPDATES_PER_SECOND;
            counter = clientEventCounters.cursorUpdates;
            break;
        default:
            return true;
    }
    
    if (counter.length >= limit) {
        console.warn(`⚠️ Rate limit côté client dépassé pour ${eventType}`);
        return false;
    }
    
    counter.push(now);
    return true;
}
```

### ✅ 3. Détection et déconnexion automatique des clients abusifs

#### Détection d'abus
- **Seuils configurables** : 50 événements en 10 secondes
- **Marquage automatique** : Ajout à une liste d'abus détectés
- **Déconnexion forcée** : Fermeture de la connexion après notification

```javascript
// Détection d'abus
function checkSocketRateLimit(socketId, eventType) {
    // ... vérification des limites ...
    
    // Vérifier le seuil d'abus
    const abuseWindowEvents = counters.events.filter(
        timestamp => timestamp > now - RATE_LIMIT_CONFIG.ABUSE_WINDOW
    );
    
    if (abuseWindowEvents.length > RATE_LIMIT_CONFIG.ABUSE_THRESHOLD) {
        console.error(`🚨 Abus détecté pour socket ${socketId}: ${abuseWindowEvents.length} événements`);
        abuseDetected.add(socketId);
        return false;
    }
    
    return true;
}

// Déconnexion d'un client abusif
function disconnectAbusiveSocket(socket, reason) {
    console.error(`🚨 Déconnexion d'un client abusif: ${socket.id} - ${reason}`);
    
    // Notifier le client
    socket.emit('error', {
        message: 'Connexion fermée pour abus détecté',
        type: 'abuse_detected',
        reason: reason
    });
    
    // Déconnecter après un court délai
    setTimeout(() => {
        socket.disconnect(true);
    }, 1000);
}
```

#### Gestion côté client
- **Détection des erreurs d'abus** : Gestion spéciale des messages d'erreur
- **Déconnexion automatique** : Retour à l'écran de connexion
- **Messages informatifs** : Explication de la déconnexion

```javascript
// Gestion des erreurs d'abus côté client
socket.on('error', (data) => {
    if (data.type === 'abuse_detected') {
        showError(`🚨 ${data.message}`);
        console.error('🚨 Abus détecté:', data.reason);
        
        // Déconnexion automatique après 3 secondes
        setTimeout(() => {
            showLoginInterface();
        }, 3000);
        return;
    }
    
    if (data.message && data.message.includes('rate limit')) {
        showError(`⚠️ ${data.message} - Veuillez ralentir vos actions`);
        return;
    }
    
    showError(data.message);
});
```

### ✅ 4. Monitoring et surveillance

#### Statistiques de sécurité
- **Compteurs actifs** : Nombre de sockets et IPs surveillés
- **Abus détectés** : Nombre de clients marqués comme abusifs
- **Configuration** : Affichage des limites configurées

```javascript
// Route de monitoring avec statistiques de sécurité
app.get('/status', (req, res) => {
    const securityStats = {
        activeSocketCounters: socketEventCounters.size,
        activeIPCounters: ipRequestCounters.size,
        abuseDetectedCount: abuseDetected.size,
        rateLimitConfig: RATE_LIMIT_CONFIG
    };
    
    res.json({
        status: 'online',
        uptime: uptime,
        totalConnections: io.engine.clientsCount,
        totalUsers: totalUsers,
        eventsPerMinute: eventsPerMinute,
        totalEvents: eventCounter,
        rooms: rooms,
        security: securityStats,
        timestamp: new Date().toISOString()
    });
});
```

#### Interface de monitoring
- **Statistiques en temps réel** : Mise à jour toutes les 2 secondes
- **Indicateurs visuels** : Couleurs pour les abus détectés
- **Graphiques d'activité** : Visualisation de l'activité en temps réel

### ✅ 5. Nettoyage et maintenance

#### Nettoyage périodique
- **Compteurs expirés** : Suppression automatique des anciens compteurs
- **Abus anciens** : Nettoyage de la liste d'abus détectés
- **Optimisation mémoire** : Éviter l'accumulation de données

```javascript
// Nettoyage périodique toutes les 5 minutes
function periodicCleanup() {
    const now = Date.now();
    
    // Nettoyer les compteurs de sockets expirés
    for (const [socketId, counters] of socketEventCounters.entries()) {
        if (now - counters.lastCleanup > 300000) { // 5 minutes
            socketEventCounters.delete(socketId);
        }
    }
    
    // Nettoyer les compteurs d'IP expirés
    for (const [ip, counters] of ipRequestCounters.entries()) {
        if (now - counters.lastCleanup > 3600000) { // 1 heure
            ipRequestCounters.delete(ip);
        }
    }
    
    // Nettoyer les abus détectés anciens
    if (abuseDetected.size > 1000) {
        abuseDetected.clear();
        console.log('🧹 Nettoyage des abus détectés');
    }
}

setInterval(periodicCleanup, 5 * 60 * 1000);
```

## Configuration de sécurité

### Variables d'environnement
```bash
# Token d'authentification
EDITOR_TOKEN=secret123

# Limites de rate limiting (optionnel)
SOCKET_EVENTS_PER_SECOND=10
EDITOR_UPDATES_PER_SECOND=5
CURSOR_UPDATES_PER_SECOND=20
ABUSE_THRESHOLD=50
```

### Headers de sécurité (Helmet)
- **Content Security Policy** : Restriction des sources de contenu
- **X-Frame-Options** : Protection contre le clickjacking
- **X-Content-Type-Options** : Prévention du MIME sniffing
- **X-XSS-Protection** : Protection XSS du navigateur

## Bonnes pratiques implémentées

1. **Validation stricte** : Vérification de tous les types et formats
2. **Sanitisation complète** : Nettoyage côté client et serveur
3. **Rate limiting multi-niveaux** : Protection HTTP et WebSocket
4. **Détection d'abus** : Surveillance proactive des comportements suspects
5. **Déconnexion automatique** : Réaction immédiate aux abus
6. **Monitoring en temps réel** : Surveillance continue de la sécurité
7. **Nettoyage automatique** : Maintenance des compteurs et données
8. **Messages informatifs** : Communication claire des erreurs de sécurité

## Tests de sécurité

### Tests recommandés
1. **Injection XSS** : Tentative d'injection de scripts
2. **Rate limiting** : Envoi massif d'événements
3. **Validation** : Données malformées ou suspectes
4. **Abus** : Comportement anormal détecté
5. **Monitoring** : Vérification des statistiques de sécurité

### Commandes de test
```bash
# Test de rate limiting
for i in {1..20}; do
  curl -X POST http://localhost:3000/status
done

# Test d'injection XSS
curl -X POST http://localhost:3000/status \
  -H "Content-Type: application/json" \
  -d '{"username": "<script>alert(\"XSS\")</script>"}'
```

## Conclusion

L'implémentation de ces mesures de sécurité renforce considérablement la protection de l'application contre :

- **Attaques par déni de service** : Rate limiting et throttling
- **Injection XSS** : Validation et sanitisation
- **Abus de ressources** : Détection et déconnexion automatique
- **Attaques par force brute** : Limitation des tentatives
- **Contenu malveillant** : Filtrage des patterns suspects

Ces mesures garantissent une utilisation sécurisée de l'éditeur collaboratif tout en maintenant une expérience utilisateur fluide pour les utilisateurs légitimes.

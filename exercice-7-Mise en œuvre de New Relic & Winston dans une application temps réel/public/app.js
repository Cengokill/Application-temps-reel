/**
 * Application client pour tester l'API New Relic + Winston
 * 
 * @summary Interface web interactive pour tester toutes les routes de l'API
 */

let requestCount = 0;
let logs = [];

/**
 * Vérifie le statut du serveur au chargement
 */
window.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    addLog('info', 'Interface web chargée');
});

/**
 * Vérifie si le serveur répond
 * 
 * @summary Teste la connexion au serveur via /ping
 */
async function checkServerStatus() {
    try {
        const response = await fetch('/ping');
        if (response.ok) {
            updateServerStatus('✓ En ligne', true);
            addLog('info', 'Serveur accessible');
        } else {
            updateServerStatus('⚠ Erreur', false);
        }
    } catch (error) {
        updateServerStatus('✗ Hors ligne', false);
        addLog('error', 'Impossible de contacter le serveur');
    }
}

/**
 * Met à jour l'affichage du statut du serveur
 * 
 * @param {string} text - Texte à afficher
 * @param {boolean} online - État du serveur
 */
function updateServerStatus(text, online) {
    const statusElement = document.getElementById('server-status');
    statusElement.textContent = text;
    statusElement.style.color = online ? '#10b981' : '#ef4444';
}

/**
 * Met à jour le compteur de requêtes
 */
function incrementRequestCount() {
    requestCount++;
    document.getElementById('request-count').textContent = requestCount;
}

/**
 * Teste une route de l'API
 * 
 * @summary Envoie une requête GET à la route spécifiée et affiche le résultat
 * @param {string} route - Route à tester (ex: '/ping')
 * @param {string} resultId - ID de l'élément où afficher le résultat
 */
async function testRoute(route, resultId) {
    const resultElement = document.getElementById(`result-${resultId}`);
    const button = event.target;
    
    // Désactiver le bouton pendant la requête
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Chargement...';
    
    try {
        const startTime = Date.now();
        const response = await fetch(route);
        const duration = Date.now() - startTime;
        
        incrementRequestCount();
        
        if (response.ok) {
            const data = await response.json();
            showResult(resultElement, 'success', data, duration);
            addLog('info', `${route} - ${duration}ms`, data);
        } else {
            const errorData = await response.json();
            showResult(resultElement, 'error', errorData, duration);
            addLog('error', `${route} - Erreur ${response.status}`, errorData);
        }
    } catch (error) {
        showResult(resultElement, 'error', { error: error.message }, 0);
        addLog('error', `${route} - Exception`, { error: error.message });
    } finally {
        // Réactiver le bouton
        button.disabled = false;
        button.textContent = 'Tester' + (route === '/slow' ? ' (2s)' : '');
    }
}

/**
 * Affiche le résultat d'une requête
 * 
 * @summary Formate et affiche la réponse dans une carte
 * @param {HTMLElement} element - Élément où afficher le résultat
 * @param {string} type - Type de résultat ('success' ou 'error')
 * @param {Object} data - Données à afficher
 * @param {number} duration - Durée de la requête en ms
 */
function showResult(element, type, data, duration) {
    element.className = `result ${type} show`;
    
    const durationText = duration > 0 ? ` (${duration}ms)` : '';
    const statusEmoji = type === 'success' ? '✓' : '✗';
    
    element.innerHTML = `
        <strong>${statusEmoji} ${type === 'success' ? 'Succès' : 'Erreur'}${durationText}</strong>
        <pre>${JSON.stringify(data, null, 2)}</pre>
    `;
}

/**
 * Lance un test de charge
 * 
 * @summary Envoie plusieurs requêtes en parallèle pour tester la performance
 */
async function runLoadTest() {
    const count = parseInt(document.getElementById('load-count').value);
    const route = document.getElementById('load-route').value;
    const progressBar = document.getElementById('load-test-progress');
    const progressFill = document.getElementById('progress-fill');
    const resultElement = document.getElementById('load-test-result');
    
    // Réinitialiser l'affichage
    progressBar.classList.add('show');
    progressFill.style.width = '0%';
    resultElement.classList.remove('show');
    
    addLog('info', `Début du test de charge: ${count} requêtes vers ${route}`);
    
    const startTime = Date.now();
    let completed = 0;
    let successCount = 0;
    let errorCount = 0;
    const durations = [];
    
    // Fonction pour une requête individuelle
    const makeRequest = async () => {
        try {
            const reqStart = Date.now();
            const response = await fetch(route);
            const reqDuration = Date.now() - reqStart;
            
            durations.push(reqDuration);
            incrementRequestCount();
            
            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
        } finally {
            completed++;
            const progress = (completed / count) * 100;
            progressFill.style.width = `${progress}%`;
            progressFill.textContent = `${completed}/${count}`;
        }
    };
    
    // Envoyer toutes les requêtes en parallèle
    const promises = Array(count).fill().map(() => makeRequest());
    await Promise.all(promises);
    
    const totalDuration = Date.now() - startTime;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    // Afficher les résultats
    const results = {
        total: count,
        success: successCount,
        errors: errorCount,
        totalTime: `${totalDuration}ms`,
        avgTime: `${Math.round(avgDuration)}ms`,
        minTime: `${minDuration}ms`,
        maxTime: `${maxDuration}ms`,
        throughput: `${Math.round((count / totalDuration) * 1000)} req/s`
    };
    
    resultElement.className = 'result success show';
    resultElement.innerHTML = `
        <strong>✓ Test de charge terminé</strong>
        <pre>${JSON.stringify(results, null, 2)}</pre>
    `;
    
    addLog('info', `Test de charge terminé: ${successCount}/${count} succès`, results);
    
    // Masquer la barre de progression après 2 secondes
    setTimeout(() => {
        progressBar.classList.remove('show');
    }, 2000);
}

/**
 * Ajoute une entrée dans les logs
 * 
 * @summary Crée et affiche une entrée de log avec timestamp
 * @param {string} level - Niveau du log (info, warn, error, debug)
 * @param {string} message - Message du log
 * @param {Object} data - Données supplémentaires (optionnel)
 */
function addLog(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    
    logs.unshift({ timestamp, level, message, data });
    
    // Garder seulement les 50 derniers logs
    if (logs.length > 50) {
        logs.pop();
    }
    
    updateLogsDisplay();
}

/**
 * Met à jour l'affichage des logs
 * 
 * @summary Rafraîchit la liste des logs affichés
 */
function updateLogsDisplay() {
    const logsContainer = document.getElementById('logs-container');
    
    if (logs.length === 0) {
        logsContainer.innerHTML = '<p class="text-muted">Les logs s\'afficheront ici après les tests...</p>';
        return;
    }
    
    logsContainer.innerHTML = logs.map(log => `
        <div class="log-entry">
            <span class="log-timestamp">[${log.timestamp}]</span>
            <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
            <span class="log-message">${log.message}</span>
            ${log.data ? `<pre style="margin-top: 5px; font-size: 0.85rem;">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
        </div>
    `).join('');
}

/**
 * Efface tous les logs
 */
function clearLogs() {
    logs = [];
    updateLogsDisplay();
}


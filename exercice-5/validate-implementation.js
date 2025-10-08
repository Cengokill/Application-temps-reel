#!/usr/bin/env node

/**
 * Script de validation de l'implémentation Redis Pub/Sub
 * Vérifie que toutes les fonctionnalités sont correctement implémentées
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validation de l\'implémentation Redis Pub/Sub');
console.log('================================================\n');

// Liste des vérifications à effectuer
const checks = [
    {
        name: 'Dépendance ioredis présente',
        check: () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return packageJson.dependencies && packageJson.dependencies.ioredis;
        }
    },
    {
        name: 'Import Redis dans server.js',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('const Redis = require(\'ioredis\')') ||
                   serverCode.includes('const { Redis } = require(\'ioredis\')');
        }
    },
    {
        name: 'Connexions Redis (publisher/subscriber)',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('redisPublisher') && serverCode.includes('redisSubscriber');
        }
    },
    {
        name: 'Fonction initializeRedis présente',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('async function initializeRedis');
        }
    },
    {
        name: 'Souscription au canal Redis',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('REDIS_CHANNEL') && serverCode.includes('subscribe');
        }
    },
    {
        name: 'Publication des messages sur Redis',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('publishMessageToRedis') && serverCode.includes('publish');
        }
    },
    {
        name: 'Gestion des messages reçus de Redis',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('broadcastMessageFromRedis');
        }
    },
    {
        name: 'Évitement des boucles infinies (instanceId)',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('instanceId') && serverCode.includes('generateMessageId');
        }
    },
    {
        name: 'Diffusion des messages publics',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('type: \'public_message\'');
        }
    },
    {
        name: 'Diffusion des messages privés',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('type: \'private_message\'');
        }
    },
    {
        name: 'Gestion des événements utilisateur (join/left)',
        check: () => {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes('type: \'user_joined\'') &&
                   serverCode.includes('type: \'user_left\'');
        }
    },
    {
        name: 'Script start-server.sh modifié pour Docker',
        check: () => {
            if (!fs.existsSync('start-server.sh')) return false;
            const script = fs.readFileSync('start-server.sh', 'utf8');
            return script.includes('docker run') && script.includes('redis/redis-stack-server');
        }
    },
    {
        name: 'Script test-multi-instances.sh créé',
        check: () => {
            return fs.existsSync('test-multi-instances.sh');
        }
    }
];

// Exécuter les vérifications
let passed = 0;
let failed = 0;

checks.forEach(check => {
    try {
        const result = check.check();
        if (result) {
            console.log(`✅ ${check.name}`);
            passed++;
        } else {
            console.log(`❌ ${check.name}`);
            failed++;
        }
    } catch (error) {
        console.log(`❌ ${check.name} (erreur: ${error.message})`);
        failed++;
    }
});

console.log('\n================================================');
console.log(`📊 Résultats: ${passed} réussis, ${failed} échoués`);

if (failed === 0) {
    console.log('🎉 Toutes les vérifications sont passées !');
    console.log('🚀 L\'implémentation Redis Pub/Sub est complète.');
    process.exit(0);
} else {
    console.log('⚠️  Certaines vérifications ont échoué.');
    console.log('🔧 Vérifiez l\'implémentation et relancez ce script.');
    process.exit(1);
}

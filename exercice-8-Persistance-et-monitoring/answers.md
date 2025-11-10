# Réponses aux questions - Persistance et monitoring

## Question 1 – Services cloud en temps réel

### a) Services managés pour la synchronisation temps réel

Deux services managés permettant la synchronisation temps réel sont :

1. **Firebase Realtime Database** (Google)
2. **AWS AppSync** avec les subscriptions GraphQL

### b) Comparaison des services

**Firebase Realtime Database :**

- **Modèle de données** : Utilise un modèle de données JSON (sous forme d'arbre). Toutes les données sont stockées dans un seul objet JSON, ce qui peut poser problème pour les structures complexes car il n'y a pas de vraie notion de relations.

- **Persistance** : Les données sont persistées automatiquement dans le cloud.La base de données est hébergée sur les serveurs de Google et les données survivent aux redémarrages. Il y a aussi un mode offline qui permet de continuer à travailler  sans connexion.

- **Mode d'écoute** : Fonctionne avec des listeners qui écoutent les changements en temps réel. Quand une donnée change, tous les clients connectés reçoivent immédiatement la mise à jour via des websockets. On peut écouter des chemins spécifiques dans l'arbre JSON.

- **scalabilité** : Scalabilité verticale plutot que horizontale. Firebase peut gerer des milliers de connexions simultanées mais pour des applications très grandes, il faut parfois diviser en plusieurs bases de donnees. Google gère l'infrastructure automatiquement.

**AWS AppSync :**

- **Modèle de données** : Utilise GraphQL comme langage de requête. Le modèle de données est définit par un schéma GraphQL avec des types, ce qui est plus structuré que Firebase. On peut connecter plusieurs sources de données.

- **Persistance** : Ne gère pas directement la persistance, il faut connecter à une source de données comme DynamoDB ou Aurora. C'est plus flexible mais ça nécessite plus de configuration. Les données sont persistées dans la base choisie.

- **Mode d'écoute** : Utilise les subscriptions GraphQL pour le temps réel. Les clients souscrivent à des évènements spécifiques et reçoivent des notifications quand les données changent. Plus précis que Firebase car on peut définir précisément quels champs on veut écouter.

- **Scalabilité** : Excellente scalabilité car AWS gère l'infrastructure. AppSync est serverless donc il scale automatiquement selon le nombre de requêtes. Peut gérer des millions de connexions simultanées grace à l'infrastructure AWS.

### c) Cas d'usage préférés

**Firebase Realtime Database :**
C'est idéal pour une appli de chat en temps réel ou un tableau blanc collaboratif pour une équipe. Par exemple, une petite entreprise qui développe une application mobile de messagerie instantanée. Firebase est un bon service car il est simple à mettre en place, gère automatiquement la synchronisation offline, et ne nécessite pas beaucoup de configuration. Le modèle JSON convient bien pour les messages qui sont des structures simples.

**AWS AppSync :**
c'est préférable pour une application complexe avec des mises à jour en temps réel (comme e-commerce) avec par exemple des stocks, des commandes, ou des notifications. Par exemple, une grande entreprise qui a déjà son infrastructure sur AWS et qui veut ajouter du temps réel à son application existante. AppSync permet d'intégrer facilement plusieurs sources de données et offre un contrôle précisavec GraphQL. La scalabilité est meilleure pour des gros volumes.

## Question 2 – Sécurité temps réel

### a) Trois risques liés au temps réel et protections

**Risque 1 : DDoS via connexions persistantes**

Les WebSockets maintiennent des connexions ouvertes en permanence, ce qui peut etre exploité pour saturer le serveur. Un attaquant peut ouvrir des milliers de connexions simultanées et épuiser les ressources du serveur.

*Protection* : Implementer un rate limiting sur le nombre de connexions par IP, utiliser un reverse proxy comme nginx qui gère efficacement les connexions, mettre en place des timeouts pour fermer les connexions inactives, et utiliser des services (comme Cloudflare) qui détectent et bloquent les attaques DDoS automatiquement.

**Risque 2 : Flooding**

Un client malveillant peut envoyer beaucoup de messages en très peu de temps pour surcharger le serveur (et les autres clients). ça peut aussi augmenter les coûts si on paie au volume de données.

*Protection* : Mettre en place, encore, un rate limiting au niveau applicatif qui limite le nombre de messages par utilisateur et par seconde. Par exemple, maximum 10 messages par seconde par utilisateur. On peut aussi implementer un système de "throttling" qui ralentit automatiquement les clients trop actifs. Utiliser des files d'attente pour lisser les pics de charge.

**Risque 3 : Injection de données pirates**

Comme les données arrivent en temps réel, si elles ne sont pas validées correctement, un attaquant peut injecter du code JavaScript malicieux qui sera diffusé à tous les clients connectés.

*Protection* : Toujours valider et sanitizer les données côté serveur avant de les diffuser. Ne jamais faire confiance aux données du client. Utiliser des bibliothèques comme de sanitization pour nettoyer le HTML, valider le format des données, et encoder correctement les données avant de les afficher côté client.

### b) Importance de la gestion des identités

La gestion des identités est importante en temps réel car :

Les connexions WebSocket sont persistantes et peuvent durer longtemps, donc il faut s'assurer que l'utilisateur reste authentifié pendant toute la session. Si un token expire pendant une session de plusieurs heures, il faut gérer le renouvellement sans couper sa connexion.

En temps réel, plusieurs utilisateurs interagissent souvent avec les mêmes données simultanément. Il faut donc identifier précisément qui fait quoi pour appliquer les bonnes permissions. Par exemple, dans un document collaboratif comme vu dans les TP, certains utilisateurs peuvent juste lire pendant que d'autres peuvent éditer.

Sans authentification forte, n'importe qui peut se connecter et recevoir ou envoyer des données. Dans une application de chat plutôt professionnelle, on ne veut pas que des personnes non autorisées puissent écouter les conversations ou se faire passer pour quelqu'un d'autre.

Le temps réel rend aussi l'audit plus important. Il faut tracer qui a fait quelle modification et quand, ce qui nécessite une identification fiable de chaque utilisateur. Ça permet aussi de révoquer l'accès en temps réel si besoin.

## Question 3 – WebSockets vs Webhooks

### a) Définitions

**WebSockets :**
WebSocket est un protocole de communication bidirectionnel qui établit une connexion persistante entre un client et un serveur. Contrairement à HTTP qui fonctionne en requête et réponse, WebSocket maintient un canal ouvert permettant au serveur et au client d'envoyer des données à nimporte quel moment sans avoir à établir une nouvelle connexion à chaque fois.

**Webhooks :**
Un Webhook est un mécanisme de communication unidirectionnel basé sur HTTP où un serveur envoie des requêtes HTTP POST à une URL prédéfinie quand un évènement spécifique se produit. C'est une sorte de "callback" côté serveur. Le serveur source appelle l'URL du serveur destinataire pour le notifier d'un évènement, mais il n'y a pas de connexion persistante. C'est un peu comme envoyer un SMS quand quelque chose se passe.

### b) Avantages et limites

**WebSockets :**

*Avantages :*
1. **Communication bidirectionnelle en temps réel** : Le serveur peut envoyer des données au client à tout moment sans que le client ait à demander. C'est parfait pour les applications nécessitant des mises à jour instantanées, sans besoin de faire des boucles d'actualisation infinies.

2. **Faible latence** : Comme la connexion reste ouverte, il n'y a pas le overhead de créer une nouvelle connexion HTTP à chaque fois. Les messages sont transmis presque instantanément, et ça améliore beaucoup l'expérience utilisateur.

*Limites :*
1. **Complexité de gestion** : Maintenir des milliers de connexions ouvertes consomme beaucoup de ressources serveur. Il faut gérer les reconnexions, les timeouts, et c'est plus difficile à debugger qu'une requête HTTP classique.

2. **Problèmes avec les infrastructures réseau** : Certains proxies, firewalls ou load balancers ne gèrent pas bien les WebSockets. Les connexions peuvent être fermées inopinément, et il faut implementer des mécanismes de reconnexion automatique. Ça ne passe pas toujours à travers tous les réseaux d'entreprise.

**Webhooks :**

*Avantages :*
1. **Simplicité d'implémentation** : C'est juste une requête HTTP POST classique, donc facile à implémenter et à deboguer. On n'a pas besoin de gérer des connexions persistantes ou des protocoles complexes. N'importe quel langage peut facilement recevoir et traiter un Webhook.

2. **Pas de gestion de connexion** : Pas besoin de maintenir une connexion ouverte, donc moins de ressources consommées côté serveur. Le serveur envoie la notification et c'est tout, il n'a pas à garder en mémoire des milliers de connexions.

*Limites :*
1. **Unidirectionnel et asynchrone** : Le client ne peut pas initier de communication, il doit attendre que le serveur l'appelle. Il n'y a pas de dialogue en temps réel, juste des notifications ponctuelles. Si on veut une réponse, il faut faire une autre requête HTTP.

2. **Fiabilité et retry** : Si le serveur destinataire est down au moment de l'envoi, le message peut être perdu. Il faut implémenter des moyen pour réessayer automatiquement l'envoi, et gérer les cas où l'URL du webhook n'est plus valide. Certains services ont des limites sur le nombre de tentatives.

### c) Cas préférable pour un Webhook

Un Webhook est préférable dans le cas d'une **intégration serveur-à-serveur pour des notifications d'évènements ponctuels**.

Par exemple, un système de paiement (comme Stripe) qui notifie notre serveur quand un paiement est complété. Il n'ya pas besoin d'une connexion permanente, on veut juste être notifié quand un évenement important se produit (paiement réussi, paiement échoué, etc.).

**Justification :**
- Les évènements de paiement sont plutôt rares donc pas besoin d'une connexion constante
- C'est une communication serveur-à-serveur, pas avec un navigateur, donc pas de problème de firewall
- Les Webhooks sont plus simples à implementer et à maintenir pour ce cas d'usage
- Stripe peut retry automatiquement si le serveur est indisponible
- pas besoin de réponse immédiate, juste d'enregistrer l'évènement dans notre base de données
- C'est plus économique en ressources que de maintenir une connexion WebSocket ouverte juste pour recevoir quelques notifications

Autre exemple : les notifications GitHub quand quelqu'un fait un push sur un repository. Là aussi, un Webhook suffit largement.

## Question 4 – CRDT & Collaboration

### a) Définition d'un CRDT

CRDT signifie "Conflict-free Replicated Data Type" (Type de Données Répliqué sans Conflit). C'est une structure de données mathématiquement conçue pour permettre à plusieurs utilisateurs de modifier simultanément les mêmes données sur différents noeuds d'un système distribué, sans coordination centrale, tout en garantissant que toutes les répliques convergeront vers le même état final.

Les CRDT utilisent des propriétés mathématiques (commutativité, associativité) pour s'assurer que peu importe l'ordre dans lequel les modifications arrivent, le résultat final sera toujours le même. Il existe deux grandes familles : les CmRDT (operation-based) qui transmettent les opérations, et les CvRDT (state-based) qui transmettent les états.

### b) Exemple concret d'utilisation

Un excellent exemple est **Google Docs, un éditeur de texte collaboratif**.

Imaginons que deux personnes modifient le même document simultanément sans connexion internet.
Les deux modifications sont faites en même temps sans que l'un sache ce que l'autre fait.

Quand ils se reconnectent, au lieu d'avoir un conflit à résoudre (comme avec Git), le CRDT va automatiquement fusionner les deux modifications de façon cohérente. Dans tous les cas, les 2 personnes verront le même résultat final.

### c) Pourquoi un CRDT évite les conflits

Les CRDT évitent les conflits de modifications distribuées grace à leurs propriétés mathématiques :

**1. Opérations commutatives :**
L'ordre d'application des opérations n'a pas d'importance. Si Alice fait l'opération A et Bob fait l'opération B, alors A puis B donne le même résultat que B puis A.

**2. Associativité :**
Si 3 personnes font des modifications, peu importe comment on les groupe, le résultat est le même. Règle d'associativité : (A + B) + C = A + (B + C).

**3. Idempotence :**
Appliquer la même opération plusieurs fois a le même effet que l'appliquer une seule fois. Ça évite les problèmes si un message est reçu en double (à cause du réseau).

**4. Timestamps et identifiants uniques :**
Chaque modification a un identifiant unique et un timestamp qui permet de déterminer un ordre partiel. Même si 2 modifications arrivent "en même temps", il y a une façon de décider laquelle a la priorité.

**Concrètement :**
Dans un CRDT, il ne cherche pas à résoudre un conflit, il garantit mathématiquement qu'il n'y en aura pas grace à ces propriétés.

## Question 5 – Monitoring temps réel

### a) Trois métriques clés à surveiller

**1. Latence**
La latence mesure le temps entre l'envoi d'un message et sa réception. En temps réel, c'est critique car les utilisateurs attendent des mises à jour instantanées. Il faut surveiller la latence moyenne, mais surtout les percentiles élevés (p95, p99) car ce sont eux qui impactent l'experience utilisateur. Une latence qui passe de 50ms à 500ms indique un problème de performance.

**2. Nombre de connexions actives**
Ça compte le nombre de connexions persistantes ouvertes à un instant t. C'est important car chaque connexion consomme des ressources. Un pic soudain peut indiquer une attaque DDoS. Une chute brutale peut signaler un problème de connection ou un crash. Il faut aussi surveiller le taux de connexions/déconnexions par seconde.

**3. Débit de messages**
Le nombre de messages envoyés et reçus par seconde. Il permet de voir la charge réelle de l'application et de détecter des anomalies. Par exemple, si normalement on traite 1000 messages/seconde et soudainement on passe à 50000, c'est peut-etre une attaque de flooding. Il faut surveiller séparément les messages entrants et sortants.

**Autres métriques à surveiller :** le taux d'erreur des connexions, l'utilisation mémoire et CPU, temps de reconnexion après une déconnexion, taille des messages, nombre de rooms/channels actifs.

### b) Prometheus et Grafana dans ce contexte

**Prometheus** est un système de monitoring qui collecte et stocke des métriques sous forme de séries temporelles. Il fonctionne en "scrappant" régulièrement des endpoints HTTP qui exposent des métriques au format Prometheus.

Pour une application temps réel :
- on instrumente le code avec la bibliothèque client Prometheus
- on expose des métriques comme le nombre de connexions actives, la latence.
- Prometheus interroge régulièrement notre serveur pour récupérer ces métriques
- Les données sont stockées dans une BDD optimisée

**Grafana** est un outil de visualisation qui permet de créer des dashboards à partir des données de Prometheus.

Dans le contexte temps réel, Grafana aide à :
- créer des graphiques en temps réel montrant l'évolution des métriques
- définir des seuils d'alerte (exemple : alerte si latence > 3 secondes)
- Corréler différentes métriques pour identifier des problèmes (ex: pic de connexions + augmentation CPU)
- voir des modèles comme les heures de pointe ou les tendances à long terme

**Exemple concret :**
Si on voit dans Grafana que la latence augmente progressivement, on peut corréler avec d'autres graphiques pour voir que c'est lié à une augmentation du nombre de connexions. On peut alors décider de scaler horizontalement l'application avant que ça devienne critique. Sans ces outils, on découvrirait le problème seulement quand les utilisateurs commencent à se plaindre.

### c) Différence entre logs, traces, et métriques

**Logs :**
Les logs sont des enregistrements textuels d'évènements qui se sont produits dans l'application, avec un horodatage et un niveau de gravité (info, warning, error).

Les logs sont utiles pour debugger des problèmes spécifiques, faire des audits, et comprendre le pourquoi une erreur a eu lieu. Ils contiennent des informations détaillées mais sont difficiles à aggréger pour avoir une vue d'ensemble.

**Métriques :**
Les métriques sont des valeurs numériques mesurées à intervalles réguliers dans le temps. Ce sont des agrégations quantitatives comme des compteurs, des jauges, ou des histogrammes. Faciles à visualiser pour faire des statistiques.

Les métriques sont faites pour surveiller la santé globale d'une application, identifier des tendances, et pouvoir déclencher des alertes. Elles sont faciles à visualiser sous forme de graphiques.

**Traces :**
Les traces suivent le parcours complet d'une requête à travers différents services d'une architecture distribuée. Chaque trace contient plusieurs "spans" qui représentent les différentes étapes.

*Exemple :* Une requête qui arrive au load balancer, puis passe par le service d'authentification, puis le service de chat, puis la base de données. La trace montre combien de temps chaque étape a pris et peut révéler des problèmes.

Les traces sont très importantes dans les architectures microservices pour identifier où le temps est perdu quand une requête est lente. On les utilise pour savoir où est le problème dans tout le traitement.

## Question 6 – Déploiement & Connexions persistantes

### a) Impact des WebSockets sur le load balancing et la scalabilité

**Impact sur le load balancing :**

Les WebSockets posent des défis spécifiques pour le load balancing car la connexion doit rester sur le même serveur pendant toute sa durée de vie (contrairement à HTTP).

Problèmes principaux :
1. **Sticky sessions nécessaires** : Le load balancer doit router toutes les communications d'un client vers le même serveur backend. Si le client est transféré vers un autre serveur, la connexion WebSocket sera perdue. Il faut donc configurer le load balancer avec de l'affinité de session (basée sur l'IP ou sur un cookie).

2. **Distribution inégale** : Si un serveur reçoit beaucoup de nouvelles connexions au même moment, il peut devenir surchargé pendant que d'autres serveurs sont peu utilisés.

3. **Health checks complexes** : Il faut vérifier que le serveur peut  répondre à des requêtes HTTP, mais aussi maintenir des connexions WebSocket. Un serveur peut paraitre en bonne santé pour HTTP mais avoir des problèmes avec WebSocket.

**Impact sur la scalabilité :**

1. **Scaling horizontal difficile** : Quand on ajoute un nouveau serveur, seules les nouvelles connexions iront dessus. Les milliers de connexions existantes restent sur les anciens serveurs. Il faut attendre que les connexions se terminent naturellement pour que la charge se rééquilibre, ce qui peut prendre des heures.

2. **Problème de broadcast** : Si on veut envoyer un message à tous les utilisateurs connectés mais qu'ils sont répartis sur 10 serveurs, il faut un système de messagerie entre les serveurs (comme Redis) pour que tous les serveurs soient synchronisés.

3. **Consommation mémoire** : Chaque connexion consomme de la mémoire pour garder l'état. Un serveur peut gérer plusieurs milliers de connexions mais il consomme beaucoup de RAM. Le scaling vertical (augmenter la RAM) a des limites, donc il faut bien architecturer pour le scaling horizontal.

**Solutions :**
- Utiliser un load balancer qui supporte bien les WebSockets
- implémenter un système de message broker (Redis, RabbitMQ) pour la communication inter-serveurs
- monitorer le nombre de connexions par serveur et ajuster le load balancing en conséquence
-prévoir une stratégie de "drainage" des connexions lors du scaling down

### b) Pourquoi Kubernetes dans ce contexte

Kubernetes est souvent utilisé,justement pour les applications temps réel avec connexions persistantes pour plusieurs raisons :

**1. Orchestration automatique des conteneurs :**
Kubernetes gère automatiquement le déploiement, le scaling et la mise à jour des serveurs WebSocket. On définit combien d'instances on veut, et Kubernetes s'assure qu'elles tournent toujours, même si un noeud tombe en panne.

**2. Auto-scaling intelligent :**
Kubernetes peut automatiquement augmenter ou diminuer le nombre d'instances en fonction de métriques personnalisées comme le nombre de connexions actives ou l'utilisation CPU.

**3. Rolling updates sans downtime :**
Quand on déploie une nouvelle version, Kubernetes peut faire un rolling update progressif. Il créé de nouveaux pods avec la nouvelle version, attend qu'ils soient prêts, puis redirige progressivement le trafic.

**4. Service discovery et load balancing natif :**
Les services Kubernetes fournissent un load balancing automatique entre les pods. Même si des pods sont créés ou détruits, le Service maintient un endpoint stable. 

**5. Health checks et auto-healing :**
Kubernetes fait des "liveness" et "readiness probes" pour vérifier que les pods fonctionnent correctement. Si un pod ne répond plus, Kubernetes le redémarre automatiquement. On peut configurer des health checks spécifiques pour les WebSockets.

**6. Gestion des secrets et configuration :**
Les credentials pour Redis, les certificats SSL, et autres configurations sensibles peuvent etre gérés de façon sécurisée avec les Secrets et ConfigMaps Kubernetes.

**7. Isolation et ressources garanties :**
On peut définir des limites de requêtes de CPU et mémoire pour chaque pod. Ça évite qu'un pod impacte les autres.

## Question 7 – Stratégies de résilience client

### a) Trois mécanismes côté client pour gérer les déconnexions

**1. Reconnexion automatique**

Quand la connexion WebSocket est perdue (réseau instable, serveur redémarré), le client détecte automatiquement la déconnexion et essaie de se reconnecter au serveur.

Implementation :
```javascript
socket.on('disconnect', () => {
  console.log('Connexion perdue, tentative de reconnexion...');
  setTimeout(() => {
    socket.connect();
  }, 1000);
});
```

Le client garde en mémoire l'état de connexion et essaie de rétablir la connexion régulièrement jusqu'à ce que ça fonctionne. C'est transparent pour l'utilisateur qui voit juste un message "Reconnexion en cours...".

**2. Mise en file d'attente des messages**

Pendant qu'il est déconnecté, le client stocke localement tous les messages que l'utilisateur essaie d'envoyer dans une queue. Une fois reconnecté, tous les messages en attente sont envoyés au serveur dans l'ordre.

Implémentation :
```javascript
let messageQueue = [];
let isConnected = false;

function sendMessage(message) {
  if (isConnected) {
    socket.emit('message', message);
  } else {
    messageQueue.push(message);
    showUserNotification('Message sera envoyé lors de la reconnexion');
  }
}

socket.on('connect', () => {
  isConnected = true;
  while (messageQueue.length > 0) {
    socket.emit('message', messageQueue.shift());
  }
});
```

**3. Synchronisation d'état après reconnexion**

Après une déconnexion, le client a peut-etre manqué des messages ou des évènements. Il faut donc demander au serveur l'état actuel pour se resynchroniser.

Implementation :
```javascript
let lastReceivedMessageId = 0;

socket.on('connect', () => {
  // Demande tous les messages manqués depuis la déconnexion
  socket.emit('sync', { lastMessageId: lastReceivedMessageId });
});

socket.on('sync-response', (missedMessages) => {
  missedMessages.forEach(msg => {
    applyMessage(msg);
    lastReceivedMessageId = msg.id;
  });
});
```

Le client maintient un identifiant du dernier message reçu. Lors de la reconnexion, il demande au serveur tous les messages depuis cet identifiant. Le serveur envoie les messages manqués et le client se remet à jour.

### b) Principe d'exponential backoff

L'exponential backoff est une stratégie qui consiste à augmenter progressivement le délai entre chaque tentative de reconnexion lorsque les tentatives précédentes ont échoué.

**Principe :**

Au lieu d'essayer de se reconnecter toutes les secondes indéfiniment (ce qui surcharge le serveur), on augmente exponentiellement le délai d'attente :
- 1ère tentative : attendre 1 seconde
- 2ème tentative : attendre 2 secondes
- 3ème tentative : attendre 4 secondes
- 4ème tentative : attendre 8 secondes, etc.

**Utilité :**

1. **Protection du serveur** : Si le serveur est down ou surchargé, des milliers de clients qui essaient de se reconnecter toutes les secondes vont l'empêcher de redémarrer correctement. L'exponential backoff étale les reconnexions dans le temps.

2. **Économie de ressources** : Coté client, ça évite de gaspiller de l'énergie et de la bande passante à essayer de se connecter quand c'est clairement inutile.

3. **Résolution progressive** : Les problèmes temporaires (comme un bref problème réseau) sont résolus rapidement avec les premières tentatives rapides. Les problèmes plus longs (comme un maintenance serveur) ont des délais plus longs.

**Implémentation :**
```javascript
let reconnectAttempts = 0;
const maxDelay = 120000; // 120 secondes max

function reconnection() {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxDelay);
  const jitter = Math.random() * 1000; // 0-1 seconde aléatoire
  
  setTimeout(() => {
    socket.connect();
    reconnectAttempts++;
  }, delay + jitter);
}

socket.on('connect', () => {
  reconnectAttempts = 0; // Reset le compteur après une connexion réussie
});
```

Le jitter (bruit aléatoire) est important pour éviter que tous les clients déconnectés essaient de se reconnecter exactement au même moment, créant un nouveau pic de charge.

## Sources et Références

### Socket.IO

1. **Documentation officielle Socket.IO**
   - Socket.IO. (2024). *Introduction to Socket.IO*. 
   - URL: https://socket.io/docs/v4/
   - Référence principale pour l'implémentation WebSocket, événements, et reconnexion

2. **Socket.IO - Emit cheatsheet**
   - Socket.IO. (2024). *Emit cheatsheet*.
   - URL: https://socket.io/docs/v4/emit-cheatsheet/
   - Guide pour les différents types d'émissions (broadcast, rooms, etc.)

3. **Socket.IO - Handling CORS**
   - Socket.IO. (2024). *Handling CORS*.
   - URL: https://socket.io/docs/v4/handling-cors/
   - Configuration CORS pour applications temps réel

### SQLite

4. **SQLite Official Documentation**
   - SQLite Development Team. (2024). *SQLite Documentation*.
   - URL: https://www.sqlite.org/docs.html
   - Documentation complète sur SQLite, son architecture et best practices

5. **SQLite - When to use SQLite**
   - SQLite Development Team. (2024). *Appropriate Uses For SQLite*.
   - URL: https://www.sqlite.org/whentouse.html
   - Guide pour comprendre quand utiliser SQLite vs autres bases de données

6. **SQLite Transaction Management**
   - SQLite Development Team. (2024). *Transactions in SQLite*.
   - URL: https://www.sqlite.org/lang_transaction.html
   - Gestion des transactions ACID dans SQLite

### JWT (JSON Web Tokens)

7. **RFC 7519 - JSON Web Token (JWT)**
   - Jones, M., Bradley, J., Sakimura, N. (2015). *JSON Web Token (JWT)*.
   - IETF RFC 7519. URL: https://tools.ietf.org/html/rfc7519
   - Spécification officielle du standard JWT

8. **JWT.io - Introduction to JSON Web Tokens**
   - Auth0. (2024). *Introduction to JSON Web Tokens*.
   - URL: https://jwt.io/introduction
   - Guide pratique pour comprendre et implémenter JWT

9. **OWASP - JSON Web Token Cheat Sheet**
   - OWASP. (2024). *JSON Web Token Security Cheat Sheet*.
   - URL: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
   - Bonnes pratiques de sécurité pour JWT

### Sécurité Web

10. **OWASP Top 10**
    - OWASP Foundation. (2021). *OWASP Top 10 - 2021*.
    - URL: https://owasp.org/www-project-top-ten/
    - Les 10 risques de sécurité les plus critiques pour applications web

11. **OWASP - Input Validation Cheat Sheet**
    - OWASP. (2024). *Input Validation Cheat Sheet*.
    - URL: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
    - Validation et sanitisation des inputs utilisateur

12. **OWASP - Cross Site Scripting Prevention**
    - OWASP. (2024). *Cross Site Scripting Prevention Cheat Sheet*.
    - URL: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
    - Prévention des attaques XSS

13. **OWASP - Authentication Cheat Sheet**
    - OWASP. (2024). *Authentication Cheat Sheet*.
    - URL: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
    - Bonnes pratiques d'authentification

### WebSockets et Temps Réel

14. **MDN Web Docs - WebSockets API**
    - Mozilla. (2024). *WebSockets API*.
    - URL: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
    - Documentation de référence sur l'API WebSocket

15. **RFC 6455 - The WebSocket Protocol**
    - Fette, I., Melnikov, A. (2011). *The WebSocket Protocol*.
    - IETF RFC 6455. URL: https://tools.ietf.org/html/rfc6455
    - Spécification officielle du protocole WebSocket

### Monitoring et Logging

16. **Winston - Logger for Node.js**
    - winstonjs. (2024). *Winston - A logger for just about everything*.
    - URL: https://github.com/winstonjs/winston
    - Documentation Winston pour logging professionnel

17. **Prometheus Documentation**
    - Prometheus Authors. (2024). *Prometheus Documentation*.
    - URL: https://prometheus.io/docs/introduction/overview/
    - Système de monitoring et alerting (référencé dans les réponses)

18. **Grafana Documentation**
    - Grafana Labs. (2024). *Grafana Documentation*.
    - URL: https://grafana.com/docs/
    - Plateforme de visualisation de métriques

### Cryptographie et Hashage

19. **bcrypt - A library to help you hash passwords**
    - bcrypt on npm. (2024). *bcrypt*.
    - URL: https://www.npmjs.com/package/bcrypt
    - Documentation de la bibliothèque bcrypt pour Node.js

20. **OWASP - Password Storage Cheat Sheet**
    - OWASP. (2024). *Password Storage Cheat Sheet*.
    - URL: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
    - Bonnes pratiques pour le stockage sécurisé des mots de passe

### Scalabilité et Architecture

21. **Redis Adapter for Socket.IO**
    - Socket.IO. (2024). *Redis Adapter*.
    - URL: https://socket.io/docs/v4/redis-adapter/
    - Scalabilité horizontale avec Redis

22. **Kubernetes Documentation**
    - Kubernetes Authors. (2024). *Kubernetes Documentation*.
    - URL: https://kubernetes.io/docs/home/
    - Orchestration de containers (référencé dans les réponses)

### Services Cloud

23. **Firebase Realtime Database Documentation**
    - Google. (2024). *Firebase Realtime Database*.
    - URL: https://firebase.google.com/docs/database
    - Documentation officielle Firebase (référencé Question 1)

24. **AWS AppSync Documentation**
    - Amazon Web Services. (2024). *AWS AppSync Developer Guide*.
    - URL: https://docs.aws.amazon.com/appsync/
    - Documentation AWS AppSync (référencé Question 1)

### CRDT et Collaboration

25. **CRDT - Conflict-free Replicated Data Types**
    - Shapiro, M., Preguiça, N., Baquero, C., Zawirski, M. (2011). 
    - *Conflict-free Replicated Data Types*. INRIA Research Report.
    - URL: https://hal.inria.fr/inria-00609399v1/document
    - Article de recherche fondamental sur les CRDT

26. **Yjs - A CRDT framework**
    - Jahns, K. (2024). *Yjs - Shared Editing*.
    - URL: https://github.com/yjs/yjs
    - Implementation pratique de CRDT pour édition collaborative

### Rate Limiting

27. **express-rate-limit**
    - express-rate-limit on npm. (2024). *express-rate-limit*.
    - URL: https://www.npmjs.com/package/express-rate-limit
    - Middleware de rate limiting pour Express

28. **OWASP - Denial of Service Cheat Sheet**
    - OWASP. (2024). *Denial of Service Cheat Sheet*.
    - URL: https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html
    - Protection contre les attaques DDoS et flooding

---

**Note:** Toutes les URLs ont été vérifiées comme valides en novembre 2024. Les documents IETF RFC sont des standards officiels de l'Internet Engineering Task Force. Les documents OWASP proviennent de l'Open Web Application Security Project, une organisation reconnue mondialement pour la sécurité des applications web.


/**
 * Client Todo App - Logique principale
 * Gestion de la connexion WebSocket, reconnexion automatique, et interface
 */

// Vérifier l'authentification
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

if (!token || !username) {
  window.location.href = '/index.html';
}

// Afficher le nom d'utilisateur
document.getElementById('username-display').textContent = username;

// ============================================
// ÉTAT DE L'APPLICATION
// ============================================

let socket = null;
let todos = [];
let currentFilter = 'all';
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let actionQueue = [];

// Monitoring
let latencyHistory = [];
let lastPingTime = 0;

// ============================================
// CONNEXION WEBSOCKET
// ============================================

/**
 * Initialise la connexion Socket.IO
 * @summary Crée le socket avec authentification et configure les evenements
 */
function connectSocket() {
  console.log('Tentative de connexion au serveur...');

  socket = io({
    auth: {
      token: token
    },
    reconnection: false // On gère la reconnexion nous-mêmes
  });

  // Événements de connexion
  socket.on('connect', handleConnect);
  socket.on('disconnect', handleDisconnect);
  socket.on('connect_error', handleConnectError);

  // Événements todos
  socket.on('todo:list', handleTodoList);
  socket.on('todo:created', handleTodoCreated);
  socket.on('todo:updated', handleTodoUpdated);
  socket.on('todo:deleted', handleTodoDeleted);

  // Événements système
  socket.on('users:count', handleUsersCount);
  socket.on('pong', handlePong);
  socket.on('error', handleError);
}

/**
 * Gère la connexion réussie
 * @summary Réinitialise les tentatives, vide la queue, demande la synchro
 */
function handleConnect() {
  console.log('Connecté au serveur');
  isConnected = true;
  reconnectAttempts = 0;
  
  updateConnectionStatus('connected', 'Connecté');

  // Demander la synchronisation des todos
  socket.emit('todo:sync');

  // Traiter les actions en attente
  processQueue();

  // Démarrer le monitoring de latence
  startLatencyMonitoring();
}

/**
 * Gère la déconnexion
 * @summary Met à jour l'interface et lance la reconnexion
 */
function handleDisconnect(reason) {
  console.log('Déconnecté:', reason);
  isConnected = false;
  
  updateConnectionStatus('disconnected', 'Déconnecté');

  // Ne pas se reconnecter si c'est volontaire
  if (reason !== 'io client disconnect') {
    scheduleReconnect();
  }
}

/**
 * Gère les erreurs de connexion
 * @summary Log l'erreur et programme une reconnexion
 */
function handleConnectError(error) {
  console.error('Erreur de connexion:', error.message);
  isConnected = false;
  
  updateConnectionStatus('error', 'Erreur de connexion');

  // Si token invalide, rediriger vers login
  if (error.message.includes('Token')) {
    showError('Session expirée, veuillez vous reconnecter');
    setTimeout(() => {
      localStorage.clear();
      window.location.href = '/index.html';
    }, 2000);
    return;
  }

  scheduleReconnect();
}

/**
 * Programme une reconnexion avec exponential backoff
 * @summary Augmente progressivement le délai entre les tentatives
 */
function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
  const baseDelay = 1000;
  const maxDelay = 30000;
  const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
  
  // Ajouter du jitter (bruit aléatoire) pour éviter que tous les clients se reconnectent en même temps
  const jitter = Math.random() * 1000;
  const totalDelay = delay + jitter;

  reconnectAttempts++;
  
  console.log(`Reconnexion dans ${Math.round(totalDelay / 1000)}s (tentative ${reconnectAttempts})...`);
  updateConnectionStatus('reconnecting', `Reconnexion dans ${Math.round(totalDelay / 1000)}s...`);

  reconnectTimeout = setTimeout(() => {
    console.log('Tentative de reconnexion...');
    connectSocket();
  }, totalDelay);
}

/**
 * Met à jour le statut de connexion dans l'interface
 * @param {string} status - État: connected, disconnected, reconnecting, error
 * @param {string} text - Texte à afficher
 */
function updateConnectionStatus(status, text) {
  const statusElement = document.getElementById('connection-status');
  const statusDot = statusElement.querySelector('.status-dot');
  const statusText = statusElement.querySelector('.status-text');

  statusElement.className = 'connection-status ' + status;
  statusText.textContent = text;
}

// ============================================
// GESTION DE LA QUEUE D'ACTIONS
// ============================================

/**
 * Ajoute une action à la queue si déconnecté
 * @param {Function} action - Fonction à exécuter
 * @summary Stocke les actions pendant la déconnexion
 */
function queueOrExecute(action) {
  if (isConnected) {
    action();
  } else {
    actionQueue.push(action);
    console.log('Action mise en queue (déconnecté)');
    showError('Déconnecté - L\'action sera envoyée lors de la reconnexion');
  }
}

/**
 * Traite toutes les actions en attente
 * @summary Vide la queue après reconnexion
 */
function processQueue() {
  if (actionQueue.length > 0) {
    console.log(`Traitement de ${actionQueue.length} action(s) en attente...`);
    
    while (actionQueue.length > 0) {
      const action = actionQueue.shift();
      action();
    }
  }
}

// ============================================
// GESTION DES TODOS
// ============================================

/**
 * Reçoit la liste complète des todos
 * @param {Array} todoList - Liste des todos
 */
function handleTodoList(todoList) {
  console.log('Synchronisation:', todoList.length, 'todo(s)');
  todos = todoList;
  renderTodos();
}

/**
 * Nouveau todo créé
 * @param {Object} todo - Todo créé
 */
function handleTodoCreated(todo) {
  console.log('Todo créé:', todo);
  
  // Ajouter au début de la liste
  todos.unshift(todo);
  renderTodos();
}

/**
 * Todo mis à jour
 * @param {Object} updatedTodo - Todo mis à jour
 */
function handleTodoUpdated(updatedTodo) {
  console.log('Todo mis à jour:', updatedTodo);
  
  const index = todos.findIndex(t => t.id === updatedTodo.id);
  if (index !== -1) {
    todos[index] = updatedTodo;
    renderTodos();
  }
}

/**
 * Todo supprimé
 * @param {Object} data - {id: number}
 */
function handleTodoDeleted(data) {
  console.log('Todo supprimé:', data.id);
  
  todos = todos.filter(t => t.id !== data.id);
  renderTodos();
}

/**
 * Crée un nouveau todo
 * @param {string} text - Texte du todo
 */
function createTodo(text) {
  queueOrExecute(() => {
    socket.emit('todo:create', { text });
  });
}

/**
 * Met à jour un todo
 * @param {number} id - ID du todo
 * @param {Object} updates - Champs à mettre à jour
 */
function updateTodo(id, updates) {
  queueOrExecute(() => {
    socket.emit('todo:update', { id, ...updates });
  });
}

/**
 * Supprime un todo
 * @param {number} id - ID du todo
 */
function deleteTodo(id) {
  queueOrExecute(() => {
    socket.emit('todo:delete', { id });
  });
}

// ============================================
// RENDU DE L'INTERFACE
// ============================================

/**
 * Affiche les todos dans l'interface
 * @summary Filtre et affiche les todos selon le filtre actif
 */
function renderTodos() {
  const listElement = document.getElementById('todos-list');
  const emptyState = document.getElementById('empty-state');
  const template = document.getElementById('todo-template');

  // Filtrer les todos
  let filteredTodos = todos;
  if (currentFilter === 'active') {
    filteredTodos = todos.filter(t => !t.completed);
  } else if (currentFilter === 'completed') {
    filteredTodos = todos.filter(t => t.completed);
  }

  // Mettre à jour les statistiques
  const completedCount = todos.filter(t => t.completed).length;
  document.getElementById('todos-count').textContent = todos.length;
  document.getElementById('todos-completed').textContent = completedCount;

  // Vider la liste
  listElement.innerHTML = '';

  // Afficher état vide si nécessaire
  if (filteredTodos.length === 0) {
    emptyState.style.display = 'block';
    if (currentFilter === 'active') {
      emptyState.querySelector('p').textContent = 'Aucune tâche active';
    } else if (currentFilter === 'completed') {
      emptyState.querySelector('p').textContent = 'Aucune tâche terminée';
    } else {
      emptyState.querySelector('p').textContent = 'Aucune tâche pour le moment';
    }
    listElement.appendChild(emptyState);
    return;
  }

  emptyState.style.display = 'none';

  // Créer les éléments
  filteredTodos.forEach(todo => {
    const todoElement = template.content.cloneNode(true);
    const todoItem = todoElement.querySelector('.todo-item');
    
    todoItem.dataset.id = todo.id;
    
    const checkbox = todoElement.querySelector('.todo-checkbox-input');
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => {
      updateTodo(todo.id, { completed: checkbox.checked });
    });

    const todoText = todoElement.querySelector('.todo-text');
    // Decoder les entités HTML
    const textarea = document.createElement('textarea');
    textarea.innerHTML = todo.text;
    todoText.textContent = textarea.value;

    if (todo.completed) {
      todoItem.classList.add('completed');
    }

    // Date de création
    const dateElement = todoElement.querySelector('.todo-date');
    const date = new Date(todo.created_at);
    dateElement.textContent = `Créé le ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    // Bouton éditer
    const editBtn = todoElement.querySelector('.edit-btn');
    const editInput = todoElement.querySelector('.todo-edit-input');
    
    editBtn.addEventListener('click', () => {
      todoText.style.display = 'none';
      editInput.style.display = 'block';
      editInput.value = textarea.value;
      editInput.focus();
    });

    editInput.addEventListener('blur', () => {
      const newText = editInput.value.trim();
      if (newText && newText !== textarea.value) {
        updateTodo(todo.id, { text: newText });
      }
      todoText.style.display = 'block';
      editInput.style.display = 'none';
    });

    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        editInput.blur();
      } else if (e.key === 'Escape') {
        editInput.value = textarea.value;
        editInput.blur();
      }
    });

    // Bouton supprimer
    const deleteBtn = todoElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      if (confirm('Voulez-vous vraiment supprimer cette tâche ?')) {
        deleteTodo(todo.id);
      }
    });

    listElement.appendChild(todoElement);
  });
}

// ============================================
// MONITORING
// ============================================

/**
 * Reçoit le nombre d'utilisateurs connectés
 * @param {number} count - Nombre d'utilisateurs
 */
function handleUsersCount(count) {
  document.getElementById('users-count').textContent = count;
}

/**
 * Démarre le monitoring de latence
 * @summary Envoie un ping toutes les 5 secondes
 */
function startLatencyMonitoring() {
  setInterval(() => {
    if (isConnected) {
      lastPingTime = Date.now();
      socket.emit('ping', lastPingTime);
    }
  }, 5000);
}

/**
 * Reçoit le pong et calcule la latence
 * @param {number} timestamp - Timestamp envoyé avec le ping
 */
function handlePong(timestamp) {
  const latency = Date.now() - timestamp;
  latencyHistory.push(latency);

  // Garder seulement les 10 dernières mesures
  if (latencyHistory.length > 10) {
    latencyHistory.shift();
  }

  // Calculer la moyenne
  const avgLatency = Math.round(
    latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length
  );

  document.getElementById('latency-display').textContent = avgLatency + ' ms';
}

/**
 * Affiche un message d'erreur
 * @param {string} message - Message à afficher
 */
function handleError(data) {
  showError(data.message);
}

/**
 * Affiche un message d'erreur temporaire
 * @param {string} message - Message à afficher
 */
function showError(message) {
  const banner = document.getElementById('error-banner');
  banner.textContent = message;
  banner.style.display = 'block';

  setTimeout(() => {
    banner.style.display = 'none';
  }, 5000);
}

// ============================================
// ÉVÉNEMENTS INTERFACE
// ============================================

// Formulaire d'ajout
document.getElementById('add-todo-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const input = document.getElementById('todo-input');
  const text = input.value.trim();

  if (text) {
    createTodo(text);
    input.value = '';
  }
});

// Filtres
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentFilter = btn.dataset.filter;
    renderTodos();
  });
});

// Déconnexion
document.getElementById('logout-btn').addEventListener('click', () => {
  if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
    localStorage.clear();
    if (socket) {
      socket.disconnect();
    }
    window.location.href = '/index.html';
  }
});

// ============================================
// INITIALISATION
// ============================================

console.log('Initialisation de l\'application...');
connectSocket();


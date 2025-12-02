/**
 * Client Todo App - Logique principale
 * Gestion de la connexion WebSocket, reconnexion automatique, et interface
 */

// Authentification
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

// console.log('token:', token ? 'ok' : 'manquant');
// console.log('user:', username);

if (!token || !username) {
  // console.log('pas de token, redirect login');
  window.location.href = '/index.html';
}

// Affiche le nom d'utilisateur
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
  // console.log('config socketio');

  socket = io({
    auth: {
      token: token
    },
    reconnection: false // On gère la reconnexion nous-mêmes
  });

  // console.log('socket id:', socket.id);

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
  // console.log('socket id:', socket.id);
  // console.log('reconnect attempts reset');
  
  isConnected = true;
  reconnectAttempts = 0;
  
  updateConnectionStatus('connected', 'Connecté');

  // Demande la synchronisation des todos
  // console.log('demande sync todos');
  socket.emit('todo:sync');

  // Traite les actions en attente
  processQueue();

  // Démarre le monitoring de latence
  startLatencyMonitoring();
}

/**
 * Gère la déconnexion
 * @summary Met à jour l'interface et lance la reconnexion
 */
function handleDisconnect(reason) {
  console.log('Déconnecté:', reason);
  // console.log('raison disconnect:', reason);
  // console.log('connected:', isConnected, 'queue:', actionQueue.length);
  
  isConnected = false;
  
  updateConnectionStatus('disconnected', 'Déconnecté');

  // Ne pas se reconnecter si c'est volontaire
  if (reason !== 'io client disconnect') {
    // console.log('disconnect involontaire, reconnect...');
    scheduleReconnect();
  } else {
    // console.log('disconnect volontaire, pas de reconnect');
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
  
  // Ajoute du jitter (bruit aléatoire) pour éviter que tous les clients se reconnectent en même temps
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
    // console.log('action directe (connecté)');
    action();
  } else {
    actionQueue.push(action);
    console.log('Action mise en queue (déconnecté)');
    // console.log('queue size:', actionQueue.length);
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
  // console.log('todos reçus:', todoList);
  // console.log('ancien:', todos.length, 'nouveau:', todoList.length);
  
  todos = todoList;
  renderTodos();
}

/**
 * Nouveau todo créé
 * @param {Object} todo - Todo créé
 */
function handleTodoCreated(todo) {
  console.log('Todo créé:', todo);
  // console.log('todo id:', todo.id, 'text:', todo.text.substring(0, 30));
  
  // Ajoute au début de la liste
  todos.unshift(todo);
  // console.log('total todos:', todos.length);
  renderTodos();
}

/**
 * Todo mis à jour
 * @param {Object} updatedTodo - Todo mis à jour
 */
function handleTodoUpdated(updatedTodo) {
  console.log('Todo mis à jour:', updatedTodo);
  // console.log('update todo id:', updatedTodo.id);
  // console.log('changements:', updatedTodo);
  
  const index = todos.findIndex(t => t.id === updatedTodo.id);
  if (index !== -1) {
    // console.log('todo trouvé index:', index);
    todos[index] = updatedTodo;
    renderTodos();
  } else {
    // console.log('todo pas trouvé id:', updatedTodo.id);
  }
}

/**
 * Todo supprimé
 * @param {Object} data - {id: number}
 */
function handleTodoDeleted(data) {
  console.log('Todo supprimé:', data.id);
  // console.log('avant suppression:', todos.length);
  
  todos = todos.filter(t => t.id !== data.id);
  // console.log('après suppression:', todos.length);
  renderTodos();
}

/**
 * Crée un nouveau todo
 * @param {string} text - Texte du todo
 */
function createTodo(text) {
  // console.log('create todo:', text.substring(0, 30));
  queueOrExecute(() => {
    // console.log('emit todo:create');
    socket.emit('todo:create', { text });
  });
}

/**
 * Met à jour un todo
 * @param {number} id - ID du todo
 * @param {Object} updates - Champs à mettre à jour
 */
function updateTodo(id, updates) {
  // console.log('update todo:', id, updates);
  queueOrExecute(() => {
    // console.log('emit todo:update');
    socket.emit('todo:update', { id, ...updates });
  });
}

/**
 * Supprime un todo
 * @param {number} id - ID du todo
 */
function deleteTodo(id) {
  // console.log('delete todo:', id);
  queueOrExecute(() => {
    // console.log('emit todo:delete');
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
  const template = document.getElementById('todo-template');

  // console.log('render todos, filter:', currentFilter);
  // console.log('total:', todos.length);

  // Filtre les todos
  let filteredTodos = todos;
  if (currentFilter === 'active') {
    filteredTodos = todos.filter(t => !t.completed);
    // console.log('actifs:', filteredTodos.length);
  } else if (currentFilter === 'completed') {
    filteredTodos = todos.filter(t => t.completed);
    // console.log('terminés:', filteredTodos.length);
  }

  // Met à jour les statistiques
  const completedCount = todos.filter(t => t.completed).length;
  document.getElementById('todos-count').textContent = todos.length;
  document.getElementById('todos-completed').textContent = completedCount;

  // Vide la liste
  listElement.innerHTML = '';

  // Affiche l'état vide si nécessaire
  if (filteredTodos.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.id = 'empty-state';
    
    const message = document.createElement('p');
    if (currentFilter === 'active') {
      message.textContent = 'Aucune tâche active';
    } else if (currentFilter === 'completed') {
      message.textContent = 'Aucune tâche terminée';
    } else {
      message.textContent = 'Aucune tâche pour le moment';
    }
    
    const subtitle = document.createElement('p');
    subtitle.className = 'empty-state-subtitle';
    subtitle.textContent = 'Commencez par en ajouter une ci-dessus';
    
    emptyState.appendChild(message);
    emptyState.appendChild(subtitle);
    listElement.appendChild(emptyState);
    return;
  }

  // Crée les éléments
  // console.log('create', filteredTodos.length, 'elements');
  filteredTodos.forEach(todo => {
    const todoElement = template.content.cloneNode(true);
    const todoItem = todoElement.querySelector('.todo-item');
    
    // console.log('create element todo id:', todo.id);
    todoItem.dataset.id = todo.id;
    
    const checkbox = todoElement.querySelector('.todo-checkbox-input');
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => {
      // console.log('checkbox change id:', todo.id, 'completed:', checkbox.checked);
      updateTodo(todo.id, { completed: checkbox.checked });
    });

    const todoText = todoElement.querySelector('.todo-text');
    // Décode les entités HTML
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
      // console.log('edit mode id:', todo.id);
      todoText.style.display = 'none';
      editInput.style.display = 'block';
      editInput.value = textarea.value;
      editInput.focus();
    });

    editInput.addEventListener('blur', () => {
      const newText = editInput.value.trim();
      // console.log('fin edit id:', todo.id);
      if (newText && newText !== textarea.value) {
        // console.log('text changed:', textarea.value, '->', newText);
        updateTodo(todo.id, { text: newText });
      } else {
        // console.log('pas de changement');
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
      // console.log('delete request id:', todo.id);
      if (confirm('Voulez-vous vraiment supprimer cette tâche ?')) {
        // console.log('delete confirmé');
        deleteTodo(todo.id);
      } else {
        // console.log('delete annulé');
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
  // console.log('users count:', count);
  document.getElementById('users-count').textContent = count;
}

/**
 * Démarre le monitoring de latence
 * @summary Envoie un ping toutes les 5 secondes
 */
function startLatencyMonitoring() {
  // console.log('start latency monitoring');
  setInterval(() => {
    if (isConnected) {
      lastPingTime = Date.now();
      // console.log('ping sent:', lastPingTime);
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
  // console.log('pong reçu, latency:', latency, 'ms');
  
  latencyHistory.push(latency);

  // Garde seulement les 10 dernières mesures
  if (latencyHistory.length > 10) {
    latencyHistory.shift();
    // console.log('latency history limité à 10');
  }

  // Calcule la moyenne
  const avgLatency = Math.round(
    latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length
  );

  // console.log('avg latency:', avgLatency, 'ms (', latencyHistory.length, 'mesures)');
  document.getElementById('latency-display').textContent = avgLatency + ' ms';
}

/**
 * Affiche un message d'erreur
 * @param {string} message - Message à afficher
 */
function handleError(data) {
  // console.log('erreur serveur:', data);
  // console.log('error msg:', data.message);
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

  // console.log('submit form, text:', text);
  
  if (text) {
    createTodo(text);
    input.value = '';
    // console.log('input cleared');
  } else {
    // console.log('text vide, skip');
  }
});

// Filtres
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // console.log('filter change:', btn.dataset.filter);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentFilter = btn.dataset.filter;
    // console.log('nouveau filter:', currentFilter);
    renderTodos();
  });
});

// Déconnexion
document.getElementById('logout-btn').addEventListener('click', () => {
  // console.log('logout request');
  if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
    // console.log('logout confirmé, cleanup...');
    localStorage.clear();
    // console.log('localStorage cleared');
    if (socket) {
      // console.log('socket disconnect');
      socket.disconnect();
    }
    // console.log('redirect login');
    window.location.href = '/index.html';
  } else {
    // console.log('logout annulé');
  }
});

// ============================================
// INITIALISATION
// ============================================

console.log('Initialisation de l\'application...');
// console.log('user:', username);
// console.log('token:', !!token);
// console.log('init - connected:', isConnected, 'todos:', todos.length);
connectSocket();


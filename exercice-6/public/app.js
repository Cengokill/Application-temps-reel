/**
 * Application de tableau de bord collaboratif
 * Gestion des notes en temps réel avec Socket.IO
 */

// Variables globales
let socket;
let notes = [];
let editingNoteId = null;
let currentUser = null;
let authToken = null;

// Éléments DOM
const notesContainer = document.getElementById('notes-container');
const notesCount = document.getElementById('notes-count');
const newNoteContent = document.getElementById('new-note-content');
const addNoteBtn = document.getElementById('add-note-btn');
const refreshBtn = document.getElementById('refresh-btn');
const loadingElement = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');

// Éléments d'authentification
const authStatus = document.getElementById('auth-status');
const userInfo = document.getElementById('user-info');
const loginPrompt = document.getElementById('login-prompt');
const currentUsername = document.getElementById('current-username');
const logoutBtn = document.getElementById('logout-btn');
const showLoginBtn = document.getElementById('show-login-btn');
const showRegisterBtn = document.getElementById('show-register-btn');
const addNoteSection = document.getElementById('add-note-section');

// Modales
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

/**
 * Fonction d'initialisation de l'application
 */
function initApp() {
    console.log('Initialisation de l\'application...');

    // Vérifier l'authentification existante
    checkExistingAuth();

    // Socket.IO sera initialisé dans updateAuthUI si l'utilisateur est connecté

    // Écouteurs d'événements DOM
    setupEventListeners();

    // Chargement initial des notes
    loadNotes();
}

/**
 * Configuration des écouteurs d'événements DOM
 */
function setupEventListeners() {
    // Ajout de nouvelle note
    addNoteBtn.addEventListener('click', handleAddNote);
    newNoteContent.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddNote();
        }
    });

    // Bouton de rafraîchissement
    refreshBtn.addEventListener('click', loadNotes);

    // Authentification
    showLoginBtn.addEventListener('click', () => showModal(loginModal));
    showRegisterBtn.addEventListener('click', () => showModal(registerModal));
    logoutBtn.addEventListener('click', handleLogout);

    // Fermeture des modales
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            hideModal(modal);
        });
    });

    // Fermeture des modales en cliquant à l'extérieur
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal);
            }
        });
    });

    // Formulaires d'authentification
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
}

/**
 * Gestionnaire d'ajout de nouvelle note
 */
async function handleAddNote() {
    if (!authToken) {
        showError('Vous devez être connecté pour ajouter une note');
        return;
    }

    const content = newNoteContent.value.trim();

    if (!content) {
        showError('Veuillez saisir le contenu de la note');
        newNoteContent.focus();
        return;
    }

    try {
        addNoteBtn.disabled = true;
        addNoteBtn.textContent = 'Ajout en cours...';

        const response = await fetch('/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                content: content
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors de l\'ajout de la note');
        }

        // Réinitialiser le formulaire
        newNoteContent.value = '';
        newNoteContent.focus();

        // La mise à jour sera reçue via Socket.IO
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la note:', error);
        showError(error.message);
    } finally {
        addNoteBtn.disabled = false;
        addNoteBtn.textContent = '➕ Ajouter une Note';
    }
}

/**
 * Chargement des notes depuis l'API
 */
async function loadNotes() {
    try {
        showLoading(true);
        hideError();

        const response = await fetch('/notes');

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des notes');
        }

        notes = await response.json();
        renderNotes();
    } catch (error) {
        console.error('Erreur lors du chargement des notes:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Rendu des notes dans l'interface
 */
function renderNotes() {
    // Vider le conteneur
    notesContainer.innerHTML = '';

    // Mettre à jour le compteur
    notesCount.textContent = notes.length;

    if (notes.length === 0) {
        // État vide
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <h3>Aucune note pour le moment</h3>
            <p>Commencez par ajouter votre première note ci-dessus !</p>
        `;
        notesContainer.appendChild(emptyState);
        return;
    }

    // Rendre chaque note
    notes.forEach(note => {
        const noteElement = createNoteElement(note);
        notesContainer.appendChild(noteElement);
    });
}

/**
 * Création d'un élément DOM pour une note
 */
function createNoteElement(note) {
    const template = document.getElementById('note-template');
    const noteElement = template.content.cloneNode(true);

    const noteDiv = noteElement.querySelector('.note');
    const contentDiv = noteElement.querySelector('.note-content');
    const authorName = noteElement.querySelector('.author-name');
    const dateSpan = noteElement.querySelector('.note-date');
    const editBtn = noteElement.querySelector('.btn-edit');
    const deleteBtn = noteElement.querySelector('.btn-delete');

    // Définir l'ID de la note
    noteDiv.dataset.noteId = note.id;

    // Contenu de la note
    contentDiv.textContent = note.content;

    // Informations sur l'auteur et la date
    authorName.textContent = note.authorUsername || note.authorId || 'Anonyme';
    dateSpan.textContent = formatDate(note.createdAt);

    // Écouteurs d'événements
    editBtn.addEventListener('click', () => startEditingNote(note));
    deleteBtn.addEventListener('click', () => deleteNote(note.id));

    // Contrôler la visibilité des boutons d'action
    if (!currentUser) {
        // Masquer tous les boutons si l'utilisateur n'est pas connecté
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    } else if (note.authorId !== currentUser.id) {
        // Masquer les boutons si l'utilisateur connecté n'est pas le propriétaire
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    } else {
        // Afficher les boutons si l'utilisateur est le propriétaire
        editBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';
    }

    return noteElement;
}

/**
 * Démarrage du mode édition d'une note
 */
function startEditingNote(note) {
    if (editingNoteId !== null) {
        // Annuler l'édition en cours si elle existe
        cancelEditing();
    }

    const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
    const contentDiv = noteElement.querySelector('.note-content');

    // Créer le formulaire d'édition
    const editTemplate = document.getElementById('edit-note-template');
    const editForm = editTemplate.content.cloneNode(true);

    const textarea = editForm.querySelector('.edit-content');
    const saveBtn = editForm.querySelector('.btn-save');
    const cancelBtn = editForm.querySelector('.btn-cancel');

    // Pré-remplir avec le contenu actuel
    textarea.value = note.content;

    // Remplacer le contenu par le formulaire
    contentDiv.innerHTML = '';
    contentDiv.appendChild(editForm);

    // Focus sur le textarea
    textarea.focus();
    textarea.select();

    // Variables pour l'édition
    editingNoteId = note.id;

    // Écouteurs d'événements
    saveBtn.addEventListener('click', () => saveNoteEdit(note.id, textarea.value.trim()));
    cancelBtn.addEventListener('click', cancelEditing);

    textarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveNoteEdit(note.id, textarea.value.trim());
        } else if (e.key === 'Escape') {
            cancelEditing();
        }
    });
}

/**
 * Sauvegarde de l'édition d'une note (via API REST ou Socket.IO)
 */
async function saveNoteEdit(noteId, newContent) {
    if (!authToken) {
        showError('Vous devez être connecté pour modifier une note');
        return;
    }

    if (!newContent) {
        showError('Le contenu de la note ne peut pas être vide');
        return;
    }

    // Utiliser Socket.IO pour une édition temps réel plus directe (optionnel)
    // Alternative : utiliser l'API REST comme avant
    const useSocketIO = socket && socket.connected;

    if (useSocketIO) {
        // Méthode Socket.IO directe
        socket.emit('edit_note', {
            noteId: parseInt(noteId),
            content: newContent.trim()
        });

        // Réinitialiser l'état d'édition
        editingNoteId = null;
    } else {
        // Fallback vers API REST
        try {
            const response = await fetch(`/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    content: newContent
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors de la mise à jour de la note');
            }

            // Réinitialiser l'état d'édition
            editingNoteId = null;

            // La mise à jour sera reçue via Socket.IO
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la note:', error);
            showError(error.message);
        }
    }
}

/**
 * Annulation de l'édition en cours
 */
function cancelEditing() {
    if (editingNoteId === null) return;

    // Recharger les notes pour annuler les modifications locales
    renderNotes();
    editingNoteId = null;
}

/**
 * Suppression d'une note (via API REST ou Socket.IO)
 */
async function deleteNote(noteId) {
    if (!authToken) {
        showError('Vous devez être connecté pour supprimer une note');
        return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
        return;
    }

    // Utiliser Socket.IO pour une suppression temps réel plus directe (optionnel)
    // Alternative : utiliser l'API REST comme avant
    const useSocketIO = socket && socket.connected;

    if (useSocketIO) {
        // Méthode Socket.IO directe
        socket.emit('delete_note', {
            noteId: parseInt(noteId)
        });
    } else {
        // Fallback vers API REST
        try {
            const response = await fetch(`/notes/${noteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors de la suppression de la note');
            }

            // La mise à jour sera reçue via Socket.IO
        } catch (error) {
            console.error('Erreur lors de la suppression de la note:', error);
            showError(error.message);
        }
    }
}

/**
 * Formatage d'une date pour l'affichage
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Affichage du message de chargement
 */
function showLoading(show) {
    loadingElement.style.display = show ? 'flex' : 'none';
}

/**
 * Affichage d'un message d'erreur
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'flex';

    // Masquer automatiquement après 5 secondes
    setTimeout(() => {
        hideError();
    }, 5000);
}

/**
 * Masquage du message d'erreur
 */
function hideError() {
    errorMessage.style.display = 'none';
}

/**
 * Fonction utilitaire pour déboguer
 */
function debugLog(message, data = null) {
    console.log(`[DEBUG] ${message}`, data);
}

// Fonctions d'authentification

/**
 * Vérification de l'authentification existante au chargement
 */
function checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');

    if (token && user) {
        try {
            authToken = token;
            currentUser = JSON.parse(user);
            updateAuthUI();
        } catch (error) {
            console.error('Erreur lors de la lecture des données d\'authentification:', error);
            clearAuth();
        }
    }
}

/**
 * Gestionnaire de connexion
 */
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showError('Veuillez remplir tous les champs');
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur lors de la connexion');
        }

        // Stocker les données d'authentification
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Mettre à jour l'interface
        updateAuthUI();
        hideModal(loginModal);
        loginForm.reset();

        showSuccess('Connexion réussie');

    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        showError(error.message);
    }
}

/**
 * Gestionnaire d'inscription
 */
async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (!username || !password || !confirmPassword) {
        showError('Veuillez remplir tous les champs');
        return;
    }

    if (password !== confirmPassword) {
        showError('Les mots de passe ne correspondent pas');
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur lors de l\'inscription');
        }

        // Stocker les données d'authentification
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Mettre à jour l'interface
        updateAuthUI();
        hideModal(registerModal);
        registerForm.reset();

        showSuccess('Inscription réussie');

    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        showError(error.message);
    }
}

/**
 * Gestionnaire de déconnexion
 */
function handleLogout() {
    clearAuth();
    showSuccess('Déconnexion réussie');
}

/**
 * Nettoyage des données d'authentification
 */
function clearAuth() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    updateAuthUI();
}

/**
 * Mise à jour de l'interface d'authentification
 */
function updateAuthUI() {
    if (currentUser && authToken) {
        // Utilisateur connecté
        userInfo.style.display = 'block';
        loginPrompt.style.display = 'none';
        addNoteSection.style.display = 'block';
        currentUsername.textContent = currentUser.username;

        // Reconnecter Socket.IO avec le nouveau token
        reconnectSocket();

        // Rafraîchir l'affichage des notes pour montrer les boutons
        renderNotes();
    } else {
        // Utilisateur non connecté
        userInfo.style.display = 'none';
        loginPrompt.style.display = 'block';
        addNoteSection.style.display = 'none';

        // Déconnecter Socket.IO
        if (socket) {
            socket.disconnect();
        }

        // Rafraîchir l'affichage des notes pour masquer les boutons
        renderNotes();
    }
}

/**
 * Reconnexion de Socket.IO avec le token actuel
 */
function reconnectSocket() {
    if (socket) {
        socket.disconnect();
    }

    // Reconnexion avec le nouveau token
    socket = io({
        auth: {
            token: authToken
        }
    });

    // Ré-attacher tous les écouteurs d'événements
    socket.on('connect', () => {
        console.log('Reconnecté au serveur Socket.IO avec authentification');
    });

    socket.on('connect_error', (error) => {
        console.error('Erreur de reconnexion Socket.IO:', error.message);
        if (error.message.includes('Token')) {
            showError('Session expirée. Veuillez vous reconnecter.');
            clearAuth();
        } else {
            showError('Erreur de connexion temps réel: ' + error.message);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Déconnecté du serveur Socket.IO:', reason);
    });

    socket.on('notes_updated', (updatedNotes) => {
        console.log('Notes mises à jour reçues:', updatedNotes);
        notes = updatedNotes;
        renderNotes();
    });

    socket.on('note_edited', (data) => {
        console.log('Note éditée via Socket.IO:', data);
        if (data.success) {
            showSuccess('Note modifiée');
        }
    });

    socket.on('note_deleted', (data) => {
        console.log('Note supprimée via Socket.IO:', data);
        if (data.success) {
            showSuccess('Note supprimée');
        }
    });

    socket.on('error', (data) => {
        console.error('Erreur Socket.IO reçue:', data);
        showError(data.message || 'Erreur lors de l\'opération');
    });
}

/**
 * Affichage d'une modale
 */
function showModal(modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Masquage d'une modale
 */
function hideModal(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

/**
 * Affichage d'un message de succès
 */
function showSuccess(message) {
    // Créer un élément de message temporaire
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 2000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(successDiv);

    // Supprimer après 3 secondes
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Initialisation de l'application au chargement de la page
document.addEventListener('DOMContentLoaded', initApp);

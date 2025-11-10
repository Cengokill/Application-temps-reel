/**
 * Tableau de Bord Collaboratif - Client JavaScript
 * Gestion de l'interface utilisateur, des appels API et de Socket.IO
 */

// Variables globales
let socket = null;
let token = null;
let currentUsername = null;
let currentUserId = null;
let allNotes = [];
let currentFilter = 'all';
let noteToDelete = null;

// Couleurs pour les notes (effet Post-it)
const noteColors = [
    '#fef68a', // Jaune
    '#a7f3d0', // Vert
    '#bfdbfe', // Bleu
    '#fbbf24', // Orange
    '#fbcfe8', // Rose
    '#c7d2fe', // Violet
    '#fed7aa', // Pêche
];

// ============================================
// INITIALISATION
// ============================================

/**
 * Initialise l'application au chargement de la page
 */
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier l'authentification
    token = localStorage.getItem('token');
    currentUsername = localStorage.getItem('username');
    currentUserId = parseInt(localStorage.getItem('userId'));

    if (!token || !currentUsername) {
        // Pas de token, rediriger vers la page de connexion
        window.location.href = '/index.html';
        return;
    }

    // Afficher le nom d'utilisateur
    document.getElementById('currentUsername').textContent = currentUsername;

    // Initialiser les écouteurs d'événements
    initializeEventListeners();

    // Charger les notes initiales
    loadNotes();

    // Connecter à Socket.IO
    connectSocket();
});

// ============================================
// GESTION DES ÉVÉNEMENTS
// ============================================

/**
 * Initialise tous les écouteurs d'événements
 */
function initializeEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Formulaire d'ajout de note
    const addNoteForm = document.getElementById('addNoteForm');
    addNoteForm.addEventListener('submit', handleAddNote);

    // Compteur de caractères pour l'ajout
    const noteContent = document.getElementById('noteContent');
    noteContent.addEventListener('input', () => {
        updateCharCount(noteContent, 'charCount');
    });

    // Formulaire d'édition de note
    const editNoteForm = document.getElementById('editNoteForm');
    editNoteForm.addEventListener('submit', handleEditNote);

    // Compteur de caractères pour l'édition
    const editNoteContent = document.getElementById('editNoteContent');
    editNoteContent.addEventListener('input', () => {
        updateCharCount(editNoteContent, 'editCharCount');
    });

    // Boutons de fermeture des modals
    document.getElementById('closeModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDelete').addEventListener('click', handleConfirmDelete);

    // Fermer les modals en cliquant à l'extérieur
    window.addEventListener('click', (e) => {
        const editModal = document.getElementById('editModal');
        const deleteModal = document.getElementById('deleteModal');
        if (e.target === editModal) {
            closeEditModal();
        }
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });

    // Filtres
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNotes();
        });
    });
}

// ============================================
// GESTION DE L'AUTHENTIFICATION
// ============================================

/**
 * Déconnexion de l'utilisateur
 */
function logout() {
    // Déconnecter le socket
    if (socket) {
        socket.disconnect();
    }

    // Supprimer les données locales
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');

    // Rediriger vers la page de connexion
    window.location.href = '/index.html';
}

// ============================================
// SOCKET.IO
// ============================================

/**
 * Connecte à Socket.IO avec authentification JWT
 */
function connectSocket() {
    socket = io({
        auth: {
            token: token
        }
    });

    socket.on('connect', () => {
        console.log('✅ Connecté à Socket.IO');
        updateConnectionStatus(true);
    });

    socket.on('disconnect', () => {
        console.log('❌ Déconnecté de Socket.IO');
        updateConnectionStatus(false);
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Erreur de connexion Socket.IO:', error.message);
        updateConnectionStatus(false);
        
        if (error.message.includes('Token')) {
            // Token invalide, déconnecter
            showMessage('Session expirée, veuillez vous reconnecter', 'error');
            setTimeout(logout, 2000);
        }
    });

    // Écouter les mises à jour des notes
    socket.on('notes_updated', (notes) => {
        console.log('📝 Notes mises à jour via Socket.IO');
        allNotes = notes;
        renderNotes();
        updateStats();
    });
}

/**
 * Met à jour l'indicateur de statut de connexion
 */
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    const statusDot = statusElement.querySelector('.status-dot');
    const statusText = statusElement.querySelector('.status-text');

    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connecté';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Déconnecté';
    }
}

// ============================================
// API - NOTES
// ============================================

/**
 * Charge toutes les notes depuis l'API
 */
async function loadNotes() {
    try {
        const response = await fetch('/notes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            allNotes = await response.json();
            renderNotes();
            updateStats();
        } else if (response.status === 401 || response.status === 403) {
            showMessage('Session expirée, veuillez vous reconnecter', 'error');
            setTimeout(logout, 2000);
        } else {
            showMessage('Erreur lors du chargement des notes', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Impossible de charger les notes', 'error');
    }
}

/**
 * Gère l'ajout d'une nouvelle note
 */
async function handleAddNote(e) {
    e.preventDefault();
    clearMessage();

    const content = document.getElementById('noteContent').value.trim();
    if (!content) {
        showMessage('Veuillez entrer un contenu pour la note', 'error');
        return;
    }

    const addNoteBtn = document.getElementById('addNoteBtn');
    setLoading(addNoteBtn, true);

    try {
        const response = await fetch('/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();

        if (response.ok) {
            // Succès
            document.getElementById('noteContent').value = '';
            updateCharCount(document.getElementById('noteContent'), 'charCount');
            showMessage('Note créée avec succès !', 'success');
            
            // Les notes seront mises à jour via Socket.IO
        } else if (response.status === 401 || response.status === 403) {
            showMessage('Session expirée, veuillez vous reconnecter', 'error');
            setTimeout(logout, 2000);
        } else {
            showMessage(data.error || 'Erreur lors de la création de la note', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Impossible de créer la note', 'error');
    } finally {
        setLoading(addNoteBtn, false);
    }
}

/**
 * Ouvre le modal d'édition pour une note
 */
function openEditModal(noteId) {
    const note = allNotes.find(n => n.id === noteId);
    if (!note) return;

    // Vérifier que c'est bien la note de l'utilisateur
    if (note.authorId !== currentUserId) {
        showMessage('Vous ne pouvez modifier que vos propres notes', 'error');
        return;
    }

    document.getElementById('editNoteId').value = note.id;
    document.getElementById('editNoteContent').value = note.content;
    updateCharCount(document.getElementById('editNoteContent'), 'editCharCount');
    
    document.getElementById('editModal').classList.add('active');
}

/**
 * Ferme le modal d'édition
 */
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.getElementById('editNoteForm').reset();
}

/**
 * Gère la modification d'une note
 */
async function handleEditNote(e) {
    e.preventDefault();
    clearMessage();

    const noteId = parseInt(document.getElementById('editNoteId').value);
    const content = document.getElementById('editNoteContent').value.trim();

    if (!content) {
        showMessage('Veuillez entrer un contenu pour la note', 'error');
        return;
    }

    const saveEditBtn = document.getElementById('saveEditBtn');
    setLoading(saveEditBtn, true);

    try {
        const response = await fetch(`/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();

        if (response.ok) {
            // Succès
            closeEditModal();
            showMessage('Note modifiée avec succès !', 'success');
            
            // Les notes seront mises à jour via Socket.IO
        } else if (response.status === 401 || response.status === 403) {
            if (data.error && data.error.includes('propres notes')) {
                showMessage(data.error, 'error');
            } else {
                showMessage('Session expirée, veuillez vous reconnecter', 'error');
                setTimeout(logout, 2000);
            }
        } else {
            showMessage(data.error || 'Erreur lors de la modification de la note', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Impossible de modifier la note', 'error');
    } finally {
        setLoading(saveEditBtn, false);
    }
}

/**
 * Ouvre le modal de confirmation de suppression
 */
function openDeleteModal(noteId) {
    const note = allNotes.find(n => n.id === noteId);
    if (!note) return;

    // Vérifier que c'est bien la note de l'utilisateur
    if (note.authorId !== currentUserId) {
        showMessage('Vous ne pouvez supprimer que vos propres notes', 'error');
        return;
    }

    noteToDelete = noteId;
    document.getElementById('deleteModal').classList.add('active');
}

/**
 * Ferme le modal de suppression
 */
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    noteToDelete = null;
}

/**
 * Confirme et exécute la suppression d'une note
 */
async function handleConfirmDelete() {
    if (!noteToDelete) return;

    clearMessage();
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    setLoading(confirmDeleteBtn, true);

    try {
        const response = await fetch(`/notes/${noteToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            // Succès
            closeDeleteModal();
            showMessage('Note supprimée avec succès !', 'success');
            
            // Les notes seront mises à jour via Socket.IO
        } else if (response.status === 401 || response.status === 403) {
            if (data.error && data.error.includes('propres notes')) {
                showMessage(data.error, 'error');
            } else {
                showMessage('Session expirée, veuillez vous reconnecter', 'error');
                setTimeout(logout, 2000);
            }
        } else {
            showMessage(data.error || 'Erreur lors de la suppression de la note', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Impossible de supprimer la note', 'error');
    } finally {
        setLoading(confirmDeleteBtn, false);
    }
}

// ============================================
// INTERFACE UTILISATEUR
// ============================================

/**
 * Affiche les notes dans la grille
 */
function renderNotes() {
    const notesGrid = document.getElementById('notesGrid');
    
    // Filtrer les notes selon le filtre actif
    let filteredNotes = allNotes;
    if (currentFilter === 'mine') {
        filteredNotes = allNotes.filter(note => note.authorId === currentUserId);
    } else if (currentFilter === 'others') {
        filteredNotes = allNotes.filter(note => note.authorId !== currentUserId);
    }

    // Trier par date de création (plus récent en premier)
    filteredNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filteredNotes.length === 0) {
        notesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>Aucune note à afficher</p>
                <p class="empty-hint">${currentFilter === 'mine' ? 'Créez votre première note ci-dessus !' : 'Changez le filtre pour voir d\'autres notes'}</p>
            </div>
        `;
        return;
    }

    notesGrid.innerHTML = filteredNotes.map((note, index) => {
        const isOwner = note.authorId === currentUserId;
        const color = noteColors[index % noteColors.length];
        const rotation = (index % 3) - 1; // -1, 0, 1 degrés
        const createdDate = formatDate(note.createdAt);
        const updatedDate = note.updatedAt !== note.createdAt ? formatDate(note.updatedAt) : null;

        return `
            <div class="note-card" style="background-color: ${color}; transform: rotate(${rotation}deg);">
                <div class="note-header">
                    <div class="note-author">
                        <span class="author-icon">${isOwner ? '👤' : '👥'}</span>
                        <span class="author-name">${note.authorUsername}</span>
                    </div>
                    ${isOwner ? `
                        <div class="note-actions">
                            <button class="note-btn note-btn-edit" onclick="openEditModal(${note.id})" title="Modifier">
                                ✏️
                            </button>
                            <button class="note-btn note-btn-delete" onclick="openDeleteModal(${note.id})" title="Supprimer">
                                🗑️
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="note-content">
                    ${escapeHtml(note.content)}
                </div>
                <div class="note-footer">
                    <span class="note-date" title="Créé le ${createdDate}">
                        📅 ${createdDate}
                    </span>
                    ${updatedDate ? `
                        <span class="note-updated" title="Modifié le ${updatedDate}">
                            ✏️ ${updatedDate}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Met à jour les statistiques
 */
function updateStats() {
    const totalNotes = allNotes.length;
    const myNotes = allNotes.filter(note => note.authorId === currentUserId).length;
    const otherNotes = totalNotes - myNotes;

    document.getElementById('totalNotes').textContent = totalNotes;
    document.getElementById('myNotes').textContent = myNotes;
    document.getElementById('otherNotes').textContent = otherNotes;
}

/**
 * Met à jour le compteur de caractères
 */
function updateCharCount(textarea, counterId) {
    const count = textarea.value.length;
    document.getElementById(counterId).textContent = count;
}

/**
 * Affiche un message à l'utilisateur
 */
function showMessage(message, type = 'info') {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.textContent = message;
    messageContainer.className = `message-container ${type}`;
    messageContainer.style.display = 'block';

    // Masquer automatiquement après 5 secondes
    setTimeout(() => {
        messageContainer.style.display = 'none';
    }, 5000);
}

/**
 * Efface le message affiché
 */
function clearMessage() {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.style.display = 'none';
    messageContainer.textContent = '';
}

/**
 * Active/désactive l'état de chargement d'un bouton
 */
function setLoading(button, loading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';
        button.disabled = true;
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        button.disabled = false;
    }
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Formate une date ISO en format lisible
 */
function formatDate(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]).replace(/\n/g, '<br>');
}


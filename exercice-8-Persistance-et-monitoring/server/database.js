/**
 * Module de gestion de la base de données SQLite
 * Gere la persistance locale des utilisateurs et des todos
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'todos.db');

/**
 * Classe pour gérer les opérations de base de donnée
 * @summary Encapsule toutes les requettes SQL pour SQLite
 */
class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Initialise la connexion à la base de données et crée les tables
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Erreur connexion SQLite:', err);
          reject(err);
        } else {
          console.log('Connexion SQLite établie avec succès');
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  /**
   * Crée les tables si elles n'existent pas déja
   * @returns {Promise<void>}
   */
  async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ];

    for (const query of queries) {
      await this.run(query);
    }
    
    console.log('Tables créées ou déja existantes');
  }

  /**
   * Execute une requete SQL (INSERT, UPDATE, DELETE)
   * @param {string} sql - La requete SQL
   * @param {Array} params - Les parametres de la requette
   * @returns {Promise<Object>}
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Récupère une seule ligne
   * @param {string} sql - La requete SQL
   * @param {Array} params - Les parametres
   * @returns {Promise<Object|null>}
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Récupère plusieurs lignes
   * @param {string} sql - La requete SQL
   * @param {Array} params - Les parametres
   * @returns {Promise<Array>}
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // ============================================
  // OPERATIONS UTILISATEURS
  // ============================================

  /**
   * Crée un nouvel utilisateur
   * @param {string} username - Nom d'utilisateur
   * @param {string} passwordHash - Hash du mot de passe
   * @returns {Promise<number>} ID de l'utilisateur créé
   */
  async createUser(username, passwordHash) {
    const result = await this.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );
    return result.lastID;
  }

  /**
   * Trouve un utilisateur par son nom
   * @param {string} username - Nom d'utilisateur
   * @returns {Promise<Object|null>}
   */
  async getUserByUsername(username) {
    return await this.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
  }

  /**
   * Trouve un utilisateur par son ID
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<Object|null>}
   */
  async getUserById(userId) {
    return await this.get(
      'SELECT id, username, created_at FROM users WHERE id = ?',
      [userId]
    );
  }

  // ============================================
  // OPERATIONS TODOS
  // ============================================

  /**
   * Crée un nouveau todo
   * @param {number} userId - ID de l'utilisateur
   * @param {string} text - Texte du todo
   * @returns {Promise<Object>} Le todo créé
   */
  async createTodo(userId, text) {
    const result = await this.run(
      'INSERT INTO todos (user_id, text) VALUES (?, ?)',
      [userId, text]
    );
    
    return await this.get('SELECT * FROM todos WHERE id = ?', [result.lastID]);
  }

  /**
   * Récupere tous les todos d'un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<Array>}
   */
  async getTodosByUser(userId) {
    return await this.all(
      'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  }

  /**
   * Met à jour un todo
   * @param {number} todoId - ID du todo
   * @param {number} userId - ID de l'utilisateur (pour vérification)
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<Object|null>}
   */
  async updateTodo(todoId, userId, updates) {
    const fields = [];
    const params = [];

    if (updates.text !== undefined) {
      fields.push('text = ?');
      params.push(updates.text);
    }
    
    if (updates.completed !== undefined) {
      fields.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(todoId, userId);

    await this.run(
      `UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    return await this.get('SELECT * FROM todos WHERE id = ?', [todoId]);
  }

  /**
   * Supprime un todo
   * @param {number} todoId - ID du todo
   * @param {number} userId - ID de l'utilisateur (pour vérification)
   * @returns {Promise<boolean>}
   */
  async deleteTodo(todoId, userId) {
    const result = await this.run(
      'DELETE FROM todos WHERE id = ? AND user_id = ?',
      [todoId, userId]
    );
    return result.changes > 0;
  }

  /**
   * Compte le nombre de todos d'un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<number>}
   */
  async countUserTodos(userId) {
    const result = await this.get(
      'SELECT COUNT(*) as count FROM todos WHERE user_id = ?',
      [userId]
    );
    return result.count;
  }

  // ============================================
  // OPERATIONS SESSIONS
  // ============================================

  /**
   * Sauvegarde un token de session
   * @param {number} userId - ID de l'utilisateur
   * @param {string} token - Token JWT
   * @returns {Promise<number>}
   */
  async saveSession(userId, token) {
    const result = await this.run(
      'INSERT INTO sessions (user_id, token) VALUES (?, ?)',
      [userId, token]
    );
    return result.lastID;
  }

  /**
   * Vérifie si un token existe
   * @param {string} token - Token JWT
   * @returns {Promise<Object|null>}
   */
  async getSession(token) {
    return await this.get(
      'SELECT * FROM sessions WHERE token = ?',
      [token]
    );
  }

  /**
   * Ferme la connexion à la base de données
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Connexion SQLite fermée');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new Database();


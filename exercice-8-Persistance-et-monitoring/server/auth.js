/**
 * Module d'authentification
 * Gere le hashage des mots de passe et la génération/vérification des tokens JWT
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_dev_changez_moi_en_prod_svp';
const TOKEN_EXPIRATION = '24h';

/**
 * Hash un mot de passe avec bcrypt
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} Hash du mot de passe
 * @summary Utilise bcrypt pour hasher de maniere securisée
 */
async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Erreur lors du hashage:', error);
    throw new Error('Impossible de hasher le mot de passe');
  }
}

/**
 * Compare un mot de passe avec son hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash stocké en base
 * @returns {Promise<boolean>} True si le mot de passe correspond
 * @summary Verification sécurisé du mot de passe
 */
async function verifyPassword(password, hash) {
  try {
    const match = await bcrypt.compare(password, hash);
    return match;
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    return false;
  }
}

/**
 * Génère un token JWT pour un utilisateur
 * @param {Object} user - Objet utilisateur
 * @param {number} user.id - ID de l'utilisateur
 * @param {string} user.username - Nom d'utilisateur
 * @returns {string} Token JWT signé
 * @summary Crée un token avec expiration de 24h
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    username: user.username
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION
  });

  return token;
}

/**
 * Vérifie et décode un token JWT
 * @param {string} token - Token JWT à vérifier
 * @returns {Object|null} Payload décodé ou null si invalide
 * @summary Verifie la signature et l'expiration du token
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    // Token expiré ou invalide
    if (error.name === 'TokenExpiredError') {
      console.log('Token expiré');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('Token invalide');
    }
    return null;
  }
}

/**
 * Middleware Socket.IO pour authentifier les connexions
 * @param {Object} socket - Socket Socket.IO
 * @param {Function} next - Callback next
 * @summary Extrait et vérifie le token depuis le handshake
 */
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Token manquant'));
  }

  const decoded = verifyToken(token);
  
  if (!decoded) {
    return next(new Error('Token invalide ou expiré'));
  }

  // Attache les infos utilisateur au socket
  socket.userId = decoded.userId;
  socket.username = decoded.username;
  
  next();
}

/**
 * Valide les données d'inscription
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe
 * @returns {Object} {valid: boolean, error: string}
 * @summary Verifie la longueur et le format
 */
function validateRegistration(username, password) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Nom d\'utilisateur requis' };
  }

  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: 'Le nom doit faire entre 3 et 20 caractères' };
  }

  // Verification format alphanumérique simple
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Le nom ne peut contenir que lettres, chiffres et underscore' };
  }

  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Mot de passe requis' };
  }

  if (password.length < 4) {
    return { valid: false, error: 'Le mot de passe doit faire au moins 4 caractéres' };
  }

  return { valid: true };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authenticateSocket,
  validateRegistration
};


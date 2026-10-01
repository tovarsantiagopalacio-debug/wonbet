const env = require('../config/env');

/**
 * Middleware para endpoints internos: solo accesibles desde otros microservicios
 * enviando el header `x-internal-key` con la clave compartida.
 */
function internal(req, res, next) {
  const key = req.headers['x-internal-key'];
  if (!env.internalApiKey || key !== env.internalApiKey) {
    return res.status(401).json({ error: 'Clave interna inválida' });
  }
  return next();
}

module.exports = internal;
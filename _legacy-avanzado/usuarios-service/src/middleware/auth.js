const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Middleware de autenticación: valida el Bearer token (JWT) firmado por el gateway.
 * Expone req.usuario = { id, correo, rol }
 */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.usuario = { id: payload.id, correo: payload.correo, rol: payload.rol };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware de roles: restringe la ruta a ciertos roles.
 * Uso: router.get('/', requireRol('ADMIN'), handler)
 */
function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    return next();
  };
}

module.exports = { auth, requireRol };
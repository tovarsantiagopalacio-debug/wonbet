const jwt = require('jsonwebtoken');

// Misma clave secreta que usan ms-eventos y ms-apuestas para verificar el token.
// Se hardcodea a propósito, igual que en el ejemplo del profesor: así los tres
// microservicios pueden validar el JWT por su cuenta, sin llamarse entre sí.
const JWT_SECRET = 'miClaveSecretaSuperSeguraParaFirmarElTokenJwtDeWonBet';

/**
 * Middleware que verifica el token JWT del usuario.
 * Cualquier servicio con esta misma clave puede validar el token,
 * sin importar cuál lo haya generado.
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token JWT ausente. Debes enviar el header: Authorization: Bearer <token>' });
  }

  const token = authHeader.substring(7); // Quitar "Bearer "

  try {
    // Se restringe explícitamente el algoritmo esperado (recomendación oficial de
    // jsonwebtoken) para que un token no pueda forzar la verificación a usar un
    // algoritmo distinto al que realmente firmó ms-usuarios.
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.usuario = { correo: decoded.correo, rol: decoded.rol };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token JWT inválido o expirado' });
  }
}

module.exports = { verificarToken, JWT_SECRET };

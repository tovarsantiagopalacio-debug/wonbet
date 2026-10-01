const jwt = require('jsonwebtoken');

// Misma clave secreta que usan ms-usuarios y ms-eventos.
// El token fue generado por ms-usuarios; este servicio lo valida
// por su cuenta usando la misma clave, SIN llamar a ms-usuarios.
const JWT_SECRET = 'miClaveSecretaSuperSeguraParaFirmarElTokenJwtDeWonBet';

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token JWT ausente. Debes enviar el header: Authorization: Bearer <token>' });
  }

  const token = authHeader.substring(7);

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

module.exports = verificarToken;

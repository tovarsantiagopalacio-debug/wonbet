require('dotenv').config();

const env = {
  port: process.env.PORT || 4001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'secret-dev',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  internalApiKey: process.env.INTERNAL_API_KEY,
  eventosUrl: process.env.EVENTOS_URL || 'http://localhost:4002',
  apuestasUrl: process.env.APUESTAS_URL || 'http://localhost:4003',
  notificacionesUrl: process.env.NOTIFICACIONES_URL || 'http://localhost:4004',
};

module.exports = env;
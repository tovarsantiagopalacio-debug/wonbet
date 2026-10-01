const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WonBet — Usuarios Service',
      version: '1.0.0',
      description: 'Microservicio de usuarios: registro, login, JWT, roles y billetera.',
    },
    servers: [{ url: 'http://localhost:4001', description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.routes.js'],
};

module.exports = swaggerJSDoc(options);
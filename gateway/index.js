const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// En local, cada microservicio vive en localhost:puerto. Desplegado en Railway,
// cada uno vive en su propia red privada (ej. http://ms-usuarios.railway.internal:3001)
// y esa URL llega por variable de entorno — el default deja todo igual en local.
const USUARIOS_URL = process.env.USUARIOS_URL || 'http://localhost:3001';
const EVENTOS_URL = process.env.EVENTOS_URL || 'http://localhost:3002';
const APUESTAS_URL = process.env.APUESTAS_URL || 'http://localhost:3003';

app.use(cors());

// ============================================
// API GATEWAY - Solo enrutamiento
//
// Este gateway NO verifica tokens.
// Solo reenvía las peticiones al microservicio correcto.
// Cada microservicio decide si requiere autenticación.
// ============================================

function proxyA(nombre, target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        console.error(`  ✖ Error proxy a ${nombre}: ${err.message}`);
        res.status(502).json({ error: `No se pudo conectar con ${nombre} (${target}).` });
      },
    },
  });
}

// Ruta: /api/usuarios/** → ms-usuarios
app.use('/api/usuarios', proxyA('Usuarios', USUARIOS_URL));

// Ruta: /api/eventos/** → ms-eventos
app.use('/api/eventos', proxyA('Eventos', EVENTOS_URL));

// Ruta: /api/apuestas/** → ms-apuestas
app.use('/api/apuestas', proxyA('Apuestas', APUESTAS_URL));

// Endpoint de salud del gateway
app.get('/health', (req, res) => {
  res.json({
    status: 'Gateway OK',
    servicios: {
      usuarios: `${USUARIOS_URL} → /api/usuarios/*`,
      eventos: `${EVENTOS_URL} → /api/eventos/*`,
      apuestas: `${APUESTAS_URL} → /api/apuestas/*`,
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚪 API Gateway corriendo en http://localhost:${PORT}`);
  console.log(`   /api/usuarios/** → ms-usuarios (${USUARIOS_URL})`);
  console.log(`   /api/eventos/**  → ms-eventos  (${EVENTOS_URL})`);
  console.log(`   /api/apuestas/** → ms-apuestas (${APUESTAS_URL})`);
  console.log(`\n   ⚠️  Este gateway NO verifica tokens, solo enruta.`);
});

const express = require('express');
const cors = require('cors');
const db = require('./database');
const verificarToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const ESTADOS_VALIDOS = ['abierto', 'cerrado'];

// ============================================
// ENDPOINTS PROTEGIDOS (requieren token JWT)
// El token fue generado por ms-usuarios
// y este servicio lo verifica por su cuenta
// ============================================

// Listar todos los eventos
app.get('/api/eventos', verificarToken, (req, res) => {
  const eventos = db.prepare('SELECT * FROM eventos').all();
  res.json(eventos);
});

// Obtener evento por ID
app.get('/api/eventos/:id', verificarToken, (req, res) => {
  const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }
  res.json(evento);
});

// Crear evento
app.post('/api/eventos', verificarToken, (req, res) => {
  const { nombre, estado } = req.body;
  const cuota = Number(req.body.cuota);

  if (!nombre || req.body.cuota == null) {
    return res.status(400).json({ error: 'nombre y cuota son obligatorios' });
  }
  if (!Number.isFinite(cuota) || cuota <= 0) {
    return res.status(400).json({ error: 'cuota debe ser un número mayor a 0' });
  }
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  const result = db
    .prepare('INSERT INTO eventos (nombre, cuota, estado) VALUES (?, ?, ?)')
    .run(nombre, cuota, estado || 'abierto');
  const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(evento);
});

// Actualizar evento (ej. cerrarlo cuando termina)
app.put('/api/eventos/:id', verificarToken, (req, res) => {
  const { nombre, estado } = req.body;
  const existe = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);
  if (!existe) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  let { cuota } = existe;
  if (req.body.cuota != null) {
    cuota = Number(req.body.cuota);
    if (!Number.isFinite(cuota) || cuota <= 0) {
      return res.status(400).json({ error: 'cuota debe ser un número mayor a 0' });
    }
  }
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  db.prepare('UPDATE eventos SET nombre = ?, cuota = ?, estado = ? WHERE id = ?')
    .run(nombre || existe.nombre, cuota, estado || existe.estado, req.params.id);
  const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);
  res.json(evento);
});

// Eliminar evento
app.delete('/api/eventos/:id', verificarToken, (req, res) => {
  const result = db.prepare('DELETE FROM eventos WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }
  res.json({ message: 'Evento eliminado' });
});

// ============================================
// ENDPOINT INTERNO (sin token)
// Para comunicación entre microservicios: ms-apuestas
// lo llama directamente para saber cuota/estado de un evento
// ============================================
app.get('/internal/eventos/:id', (req, res) => {
  const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }
  res.json(evento);
});

app.listen(PORT, () => {
  console.log(`🏟️  Microservicio Eventos corriendo en http://localhost:${PORT}`);
  console.log(`   Endpoints protegidos con JWT (token de ms-usuarios)`);
});

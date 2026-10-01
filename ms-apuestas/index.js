const express = require('express');
const cors = require('cors');
const db = require('./database');
const verificarToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3003;

// URL del microservicio de Eventos (comunicación directa, sin pasar por el Gateway).
// En Railway esto llega como la URL de red privada del servicio ms-eventos.
const EVENTOS_URL = process.env.EVENTOS_URL || 'http://localhost:3002';

app.use(cors());
app.use(express.json());

// ============================================
// ENDPOINTS PROTEGIDOS (requieren token JWT)
// ============================================

// Listar todas las apuestas
app.get('/api/apuestas', verificarToken, (req, res) => {
  const apuestas = db.prepare('SELECT * FROM apuestas ORDER BY fecha DESC').all();
  res.json(apuestas);
});

// Obtener apuesta por ID
app.get('/api/apuestas/:id', verificarToken, (req, res) => {
  const apuesta = db.prepare('SELECT * FROM apuestas WHERE id = ?').get(req.params.id);
  if (!apuesta) {
    return res.status(404).json({ error: 'Apuesta no encontrada' });
  }
  res.json(apuesta);
});

// Crear apuesta
// Este endpoint demuestra COMUNICACIÓN ENTRE MICROSERVICIOS:
// Apuestas consulta a Eventos para obtener la cuota y el estado del evento
app.post('/api/apuestas', verificarToken, async (req, res) => {
  const { evento_id } = req.body;
  const monto = Number(req.body.monto);

  if (!evento_id || req.body.monto == null) {
    return res.status(400).json({ error: 'evento_id y monto son obligatorios' });
  }

  // Number('') y Number(undefined) ya quedan cubiertos arriba; esto además rechaza
  // valores no numéricos (ej. "abc") y negativos/cero, en vez de dejar que lleguen
  // como NaN hasta el INSERT (donde SQLite los rechaza igual, pero como un 500).
  if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
  }

  // Se separan los dos try/catch a propósito: si algo falla, el mensaje de error
  // debe decir la verdad sobre qué falló (¿no se pudo hablar con Eventos? ¿o sí
  // se pudo, pero no se pudo guardar la apuesta en la base de apuestas?). Mezclar
  // ambos casos en un solo catch generaba mensajes engañosos.
  let evento;
  try {
    // ============================================
    // COMUNICACIÓN ENTRE MICROSERVICIOS
    // Apuestas consulta a Eventos usando el endpoint interno
    // (sin token, porque es comunicación interna de servicio a servicio)
    // ============================================
    const response = await fetch(`${EVENTOS_URL}/internal/eventos/${evento_id}`);

    if (!response.ok) {
      return res.status(404).json({ error: `Evento con ID ${evento_id} no encontrado en el servicio de Eventos` });
    }

    evento = await response.json();
  } catch (error) {
    console.error('Error al comunicarse con el servicio de Eventos:', error.message);
    return res.status(503).json({ error: 'No se pudo conectar con el servicio de Eventos. ¿Está corriendo en el puerto 3002?' });
  }

  // Verificar que el evento siga abierto
  if (evento.estado !== 'abierto') {
    return res.status(400).json({ error: `El evento "${evento.nombre}" ya está cerrado` });
  }

  try {
    // Calcular ganancia potencial y registrar la apuesta
    const gananciaPotencial = monto * evento.cuota;

    const result = db
      .prepare(
        `INSERT INTO apuestas (usuario_correo, evento_id, evento_nombre, monto, cuota, ganancia_potencial)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.usuario.correo, evento_id, evento.nombre, monto, evento.cuota, gananciaPotencial);

    const apuesta = db.prepare('SELECT * FROM apuestas WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Apuesta registrada exitosamente',
      apuesta,
    });
  } catch (error) {
    console.error('Error al guardar la apuesta:', error.message);
    res.status(500).json({ error: 'No se pudo registrar la apuesta' });
  }
});

app.listen(PORT, () => {
  console.log(`🎲 Microservicio Apuestas corriendo en http://localhost:${PORT}`);
  console.log(`   Endpoints protegidos con JWT (token de ms-usuarios)`);
  console.log(`   Consulta eventos en ${EVENTOS_URL}`);
});

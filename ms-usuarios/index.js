const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { verificarToken, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================
// REGISTRO (público)
// ============================================
app.post('/api/usuarios', async (req, res) => {
  const { nombre, correo, contraseña } = req.body;

  if (!nombre || !correo || !contraseña) {
    return res.status(400).json({ error: 'nombre, correo y contraseña son obligatorios' });
  }

  // Express 4 no reenvía automáticamente los errores de un handler async al
  // manejador de errores (eso solo lo hace Express 5) — sin este try/catch,
  // cualquier excepción de aquí abajo quedaría como una promesa rechazada sin
  // atender: la petición nunca respondería.
  try {
    const existe = db.prepare('SELECT id FROM usuarios WHERE correo = ?').get(correo);
    if (existe) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const hash = await bcrypt.hash(contraseña, 10);
    const result = db
      .prepare('INSERT INTO usuarios (nombre, correo, contraseña, rol) VALUES (?, ?, ?, ?)')
      .run(nombre, correo, hash, 'usuario');

    const usuario = db
      .prepare('SELECT id, nombre, correo, rol FROM usuarios WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(usuario);
  } catch (error) {
    // Si dos registros con el mismo correo llegan casi al mismo tiempo, ambos pueden
    // pasar la verificación de arriba antes de que cualquiera inserte; SQLite rechaza
    // el segundo INSERT por la restricción UNIQUE de la tabla. Lo traducimos al mismo
    // 409 en vez de dejarlo como un error 500 genérico.
    if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(error.message)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    console.error('Error al registrar usuario:', error.message);
    res.status(500).json({ error: 'No se pudo registrar el usuario' });
  }
});

// ============================================
// LOGIN → genera el JWT que usarán los demás servicios
// ============================================
app.post('/api/usuarios/login', async (req, res) => {
  const { correo, contraseña } = req.body;

  if (!correo || !contraseña) {
    return res.status(400).json({ error: 'correo y contraseña son obligatorios' });
  }

  try {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo);
    if (!usuario || !(await bcrypt.compare(contraseña, usuario.contraseña))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Algoritmo explícito (HS256): la recomendación oficial de jsonwebtoken es no
    // depender del default implícito, para que firma y verificación coincidan siempre
    // con el mismo algoritmo esperado.
    const token = jwt.sign({ correo: usuario.correo, rol: usuario.rol }, JWT_SECRET, {
      expiresIn: '2h',
      algorithm: 'HS256',
    });

    res.json({ token, correo: usuario.correo, rol: usuario.rol });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
});

// ============================================
// PERFIL (protegido con el mismo middleware que usan los otros servicios)
// ============================================
app.get('/api/usuarios/perfil', verificarToken, (req, res) => {
  const usuario = db
    .prepare('SELECT id, nombre, correo, rol FROM usuarios WHERE correo = ?')
    .get(req.usuario.correo);

  if (!usuario) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json(usuario);
});

app.listen(PORT, () => {
  console.log(`👤 Microservicio Usuarios corriendo en http://localhost:${PORT}`);
  console.log(`   Genera el JWT en /api/usuarios/login`);
});

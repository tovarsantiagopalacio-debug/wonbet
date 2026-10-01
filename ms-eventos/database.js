const { DatabaseSync } = require('node:sqlite'); // SQLite viene incluido en Node, sin instalar nada
const path = require('path');

// Crear/abrir la base de datos SQLite
const db = new DatabaseSync(path.join(__dirname, 'eventos.db'));

// Crear tabla de eventos
db.exec(`
  CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cuota REAL NOT NULL,
    estado TEXT DEFAULT 'abierto'
  )
`);

// Insertar datos de ejemplo si la tabla está vacía
const count = db.prepare('SELECT COUNT(*) as total FROM eventos').get();
if (count.total === 0) {
  const insert = db.prepare('INSERT INTO eventos (nombre, cuota, estado) VALUES (?, ?, ?)');
  insert.run('Real Madrid vs Barcelona', 1.85, 'abierto');
  insert.run('Millonarios vs Nacional', 2.10, 'abierto');
  insert.run('Boca vs River', 1.65, 'cerrado');
  console.log('✅ Datos de ejemplo insertados en eventos');
}

module.exports = db;

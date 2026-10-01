const { DatabaseSync } = require('node:sqlite'); // SQLite viene incluido en Node, sin instalar nada
const path = require('path');

// Crear/abrir la base de datos SQLite
const db = new DatabaseSync(path.join(__dirname, 'apuestas.db'));

// Crear tabla de apuestas
db.exec(`
  CREATE TABLE IF NOT EXISTS apuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_correo TEXT NOT NULL,
    evento_id INTEGER NOT NULL,
    evento_nombre TEXT NOT NULL,
    monto REAL NOT NULL,
    cuota REAL NOT NULL,
    ganancia_potencial REAL NOT NULL,
    fecha TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

module.exports = db;

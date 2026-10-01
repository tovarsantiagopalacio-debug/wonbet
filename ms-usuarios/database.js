const { DatabaseSync } = require('node:sqlite'); // SQLite viene incluido en Node, sin instalar nada
const path = require('path');

// Crear/abrir la base de datos SQLite
const db = new DatabaseSync(path.join(__dirname, 'usuarios.db'));

// Crear tabla de usuarios
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE,
    contraseña TEXT NOT NULL,
    rol TEXT DEFAULT 'usuario'
  )
`);

module.exports = db;

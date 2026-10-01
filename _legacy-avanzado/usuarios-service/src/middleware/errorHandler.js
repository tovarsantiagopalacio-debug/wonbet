function notFound(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ERROR:`, err);

  // Conflictos de unicidad (correo duplicado, etc.)
  if (err.name === 'PrismaClientKnownRequestError' && err.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único' });
  }

  const status = err.status || 500;
  return res.status(status).json({ error: err.message || 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
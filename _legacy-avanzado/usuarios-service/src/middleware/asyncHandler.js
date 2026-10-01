/**
 * Envuelve handlers async para propagar errores al middleware de errorHandler.
 * Evita try/catch repetidos en los controladores.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
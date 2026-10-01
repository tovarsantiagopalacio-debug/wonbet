const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const usuarioRepository = require('../repositories/usuario.repository');

class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const authService = {
  /**
   * Registra un usuario nuevo, hashea su password y devuelve token + perfil público.
   */
  async registrar({ nombre, correo, password }) {
    if (!nombre || !correo || !password) {
      throw new AuthError('nombre, correo y password son obligatorios');
    }
    if (password.length < 6) {
      throw new AuthError('La contraseña debe tener al menos 6 caracteres');
    }
    const correoNormalizado = correo.trim().toLowerCase();

    const existe = await usuarioRepository.findByCorreo(correoNormalizado);
    if (existe) {
      throw new AuthError('Ya existe un usuario con ese correo', 409);
    }

    const hash = await bcrypt.hash(password, env.bcryptRounds);
    const usuario = await usuarioRepository.create({
      nombre,
      correo: correoNormalizado,
      password: hash,
      rol: 'USUARIO',
    });

    const token = authService.generarToken(usuario);
    return { token, usuario: authService.toPublico(usuario) };
  },

  /**
   * Valida credenciales y devuelve token + perfil público.
   */
  async login({ correo, password }) {
    if (!correo || !password) {
      throw new AuthError('correo y password son obligatorios', 400);
    }
    const usuario = await usuarioRepository.findByCorreo(correo.trim().toLowerCase());
    if (!usuario) {
      throw new AuthError('Credenciales inválidas', 401);
    }
    const valida = await bcrypt.compare(password, usuario.password);
    if (!valida) {
      throw new AuthError('Credenciales inválidas', 401);
    }
    const token = authService.generarToken(usuario);
    return { token, usuario: authService.toPublico(usuario) };
  },

  /** Firma un JWT HS256 con el payload del usuario. */
  generarToken(usuario) {
    return jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );
  },

  /** Devuelve solo los campos seguros de exponer. */
  toPublico(u) {
    return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, saldo: u.saldo };
  },
};

module.exports = { authService, AuthError };
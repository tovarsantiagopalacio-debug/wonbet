const bcrypt = require('bcryptjs');
const env = require('../config/env');
const usuarioRepository = require('../repositories/usuario.repository');

class UsuarioError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const usuarioService = {
  /** Perfil del usuario autenticado (sin password). */
  async getPerfil(id) {
    const usuario = await usuarioRepository.findById(Number(id));
    if (!usuario) {
      throw new UsuarioError('Usuario no encontrado', 404);
    }
    return usuario;
  },

  /** Actualiza nombre y/o password del usuario autenticado. */
  async updatePerfil(id, { nombre, password }) {
    const data = {};
    if (nombre !== undefined) {
      if (!nombre.trim()) throw new UsuarioError('El nombre no puede estar vacío');
      data.nombre = nombre.trim();
    }
    if (password !== undefined) {
      if (password.length < 6) {
        throw new UsuarioError('La contraseña debe tener al menos 6 caracteres');
      }
      data.password = await bcrypt.hash(password, env.bcryptRounds);
    }
    const actualizado = await usuarioRepository.update(Number(id), data);
    return actualizado;
  },

  /** Saldo actual de la billetera. */
  async getSaldo(id) {
    const usuario = await usuarioRepository.findById(Number(id));
    if (!usuario) {
      throw new UsuarioError('Usuario no encontrado', 404);
    }
    return { saldo: usuario.saldo };
  },

  /** Recarga el saldo del usuario autenticado. */
  async recargar(id, monto) {
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0) {
      throw new UsuarioError('El monto debe ser un número mayor a 0');
    }
    const usuario = await usuarioRepository.incrementarSaldo(Number(id), monto);
    return { saldo: usuario.saldo, monto };
  },

  /**
   * Endpoint interno (otros microservicios): acredita (monto > 0) o descuenta
   * (monto < 0) saldo. Valida que no quede negativo.
   */
  async transaccionInterna(usuarioId, { monto, motivo }) {
    const id = Number(usuarioId);
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto === 0) {
      throw new UsuarioError('monto debe ser un número distinto de 0');
    }
    const usuario = await usuarioRepository.findById(id);
    if (!usuario) {
      throw new UsuarioError('Usuario no encontrado', 404);
    }
    if (monto < 0 && usuario.saldo + monto < 0) {
      throw new UsuarioError('Saldo insuficiente', 400);
    }

    const actualizado =
      monto > 0
        ? await usuarioRepository.incrementarSaldo(id, monto)
        : await usuarioRepository.descontarSaldo(id, Math.abs(monto));

    return { usuarioId: id, monto, motivo: motivo || null, saldo: actualizado.saldo };
  },
};

module.exports = { usuarioService, UsuarioError };
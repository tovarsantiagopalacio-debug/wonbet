const prisma = require('../lib/prisma');

const usuarioRepository = {
  findByCorreo: (correo) => prisma.usuario.findUnique({ where: { correo } }),

  findById: (id) => prisma.usuario.findUnique({ where: { id } }),

  create: (data) => prisma.usuario.create({ data }),

  update: (id, data) => prisma.usuario.update({ where: { id }, data }),

  incrementarSaldo: (id, monto) =>
    prisma.usuario.update({ where: { id }, data: { saldo: { increment: monto } } }),

  descontarSaldo: (id, monto) =>
    prisma.usuario.update({ where: { id }, data: { saldo: { decrement: monto } } }),
};

module.exports = usuarioRepository;
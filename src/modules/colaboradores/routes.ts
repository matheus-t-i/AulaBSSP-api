import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { param } from '../../lib/params.js';
import { createColaboradorSchema, updateColaboradorSchema } from '../../lib/schemas.js';
import { authRequired, requirePapel } from '../../middleware/auth.js';

export const colaboradoresRouter = Router();

colaboradoresRouter.get('/', authRequired, async (_req, res, next) => {
  try {
    const lista = await prisma.colaborador.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        area: true,
        capacidadeMensal: true,
        papel: true,
        ativo: true,
        criadoEm: true,
      },
    });
    res.json(lista);
  } catch (e) {
    next(e);
  }
});

colaboradoresRouter.get('/:id', authRequired, async (req, res, next) => {
  try {
    const item = await prisma.colaborador.findUnique({
      where: { id: param(req.params.id) },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        area: true,
        capacidadeMensal: true,
        papel: true,
        ativo: true,
        criadoEm: true,
      },
    });
    if (!item) throw new AppError(404, 'Colaborador não encontrado');
    res.json(item);
  } catch (e) {
    next(e);
  }
});

colaboradoresRouter.post('/', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const data = createColaboradorSchema.parse(req.body);
    const existente = await prisma.colaborador.findUnique({ where: { email: data.email } });
    if (existente) {
      if (!existente.ativo) {
        throw new AppError(
          409,
          'Já existe uma conta inativa com este e-mail. Peça ao colaborador para solicitar reativação ou aprove o pedido pendente.',
          'CONTA_INATIVA_EXISTENTE',
        );
      }
      throw new AppError(409, 'Já existe um colaborador com este e-mail');
    }

    const senhaHash = data.senha ? await bcrypt.hash(data.senha, 10) : null;
    const { senha: _s, ...rest } = data;
    const created = await prisma.colaborador.create({
      data: { ...rest, senhaHash },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        area: true,
        capacidadeMensal: true,
        papel: true,
        ativo: true,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

colaboradoresRouter.put('/:id', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const data = updateColaboradorSchema.parse(req.body);
    const { senha, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (senha) updateData.senhaHash = await bcrypt.hash(senha, 10);

    const updated = await prisma.colaborador.update({
      where: { id: param(req.params.id) },
      data: updateData,
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        area: true,
        capacidadeMensal: true,
        papel: true,
        ativo: true,
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

colaboradoresRouter.delete('/:id', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    await prisma.colaborador.update({
      where: { id: param(req.params.id) },
      data: { ativo: false },
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

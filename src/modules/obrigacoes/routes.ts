import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { param } from '../../lib/params.js';
import { createObrigacaoSchema, updateObrigacaoSchema } from '../../lib/schemas.js';
import { authRequired, requirePapel } from '../../middleware/auth.js';

export const obrigacoesRouter = Router();

obrigacoesRouter.get('/', authRequired, async (req, res, next) => {
  try {
    const { area, regime, ativo } = req.query;
    const lista = await prisma.obrigacao.findMany({
      where: {
        ...(area ? { area: String(area) as never } : {}),
        ...(ativo !== undefined ? { ativo: ativo === 'true' } : {}),
        ...(regime ? { regimesAplicaveis: { has: String(regime) as never } } : {}),
      },
      orderBy: [{ area: 'asc' }, { codigo: 'asc' }],
    });
    res.json(lista);
  } catch (e) {
    next(e);
  }
});

obrigacoesRouter.get('/:id', authRequired, async (req, res, next) => {
  try {
    const item = await prisma.obrigacao.findUnique({ where: { id: param(req.params.id) } });
    if (!item) throw new AppError(404, 'Obrigação não encontrada');
    res.json(item);
  } catch (e) {
    next(e);
  }
});

obrigacoesRouter.post('/', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const data = createObrigacaoSchema.parse(req.body);
    const created = await prisma.obrigacao.create({ data });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

obrigacoesRouter.put('/:id', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const data = updateObrigacaoSchema.parse(req.body);
    const updated = await prisma.obrigacao.update({
      where: { id: param(req.params.id) },
      data,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

obrigacoesRouter.delete('/:id', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    await prisma.obrigacao.update({
      where: { id: param(req.params.id) },
      data: { ativo: false },
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

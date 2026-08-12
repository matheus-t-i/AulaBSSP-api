import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  createClienteSchema,
  updateClienteSchema,
  vincularObrigacaoSchema,
} from '../../lib/schemas.js';
import { authRequired, requirePapel } from '../../middleware/auth.js';

export const clientesRouter = Router();

clientesRouter.get('/', authRequired, async (req, res, next) => {
  try {
    const ativo = req.query.ativo;
    const lista = await prisma.cliente.findMany({
      where: ativo === undefined ? undefined : { ativo: ativo === 'true' },
      include: {
        responsavelPadrao: { select: { id: true, nome: true } },
        _count: { select: { obrigacoes: true } },
      },
      orderBy: { razaoSocial: 'asc' },
    });
    res.json(lista);
  } catch (e) {
    next(e);
  }
});

clientesRouter.get('/:id', authRequired, async (req, res, next) => {
  try {
    const item = await prisma.cliente.findUnique({
      where: { id: req.params.id },
      include: {
        responsavelPadrao: { select: { id: true, nome: true, email: true } },
        obrigacoes: {
          include: {
            obrigacao: true,
            responsavel: { select: { id: true, nome: true } },
          },
        },
      },
    });
    if (!item) throw new AppError(404, 'Cliente não encontrado');
    res.json(item);
  } catch (e) {
    next(e);
  }
});

clientesRouter.post('/', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const data = createClienteSchema.parse(req.body);
    const { vincularPacoteRegime, ...clienteData } = data;

    const created = await prisma.cliente.create({ data: clienteData });

    if (vincularPacoteRegime) {
      const obrigacoes = await prisma.obrigacao.findMany({
        where: {
          ativo: true,
          regimesAplicaveis: { has: created.regimeTributario },
          OR: [{ requerFolha: false }, { requerFolha: created.temFolha }],
          NOT: { periodicidade: 'EVENTUAL' },
        },
      });

      for (const obr of obrigacoes) {
        await prisma.clienteObrigacao.create({
          data: {
            clienteId: created.id,
            obrigacaoId: obr.id,
            responsavelId: created.responsavelPadraoId,
            vigenciaInicio: new Date(),
          },
        });
      }
    }

    const completo = await prisma.cliente.findUnique({
      where: { id: created.id },
      include: {
        obrigacoes: { include: { obrigacao: true } },
        responsavelPadrao: { select: { id: true, nome: true } },
      },
    });

    res.status(201).json(completo);
  } catch (e) {
    next(e);
  }
});

clientesRouter.put('/:id', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const data = updateClienteSchema.parse(req.body);
    const { vincularPacoteRegime: _v, ...rest } = data;
    const updated = await prisma.cliente.update({
      where: { id: req.params.id },
      data: rest,
      include: { responsavelPadrao: { select: { id: true, nome: true } } },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

clientesRouter.delete('/:id', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    await prisma.cliente.update({
      where: { id: req.params.id },
      data: { ativo: false },
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

clientesRouter.post('/:id/obrigacoes', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const clienteId = req.params.id;
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new AppError(404, 'Cliente não encontrado');

    const data = vincularObrigacaoSchema.parse(req.body);
    const created = await prisma.clienteObrigacao.create({
      data: {
        clienteId,
        obrigacaoId: data.obrigacaoId,
        responsavelId: data.responsavelId ?? cliente.responsavelPadraoId,
        diaCustomizado: data.diaCustomizado,
        vigenciaInicio: data.vigenciaInicio ? new Date(data.vigenciaInicio) : new Date(),
        vigenciaFim: data.vigenciaFim ? new Date(data.vigenciaFim) : null,
        ativo: data.ativo ?? true,
      },
      include: {
        obrigacao: true,
        responsavel: { select: { id: true, nome: true } },
      },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

clientesRouter.delete(
  '/:id/obrigacoes/:vinculoId',
  authRequired,
  requirePapel('GESTOR'),
  async (req, res, next) => {
    try {
      await prisma.clienteObrigacao.update({
        where: { id: req.params.vinculoId },
        data: { ativo: false },
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

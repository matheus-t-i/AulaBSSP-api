import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { param } from '../../lib/params.js';
import {
  alterarSenhaSchema,
  loginSchema,
  solicitarReativacaoSchema,
} from '../../lib/schemas.js';
import { authRequired, requirePapel, signToken } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);
    const colaborador = await prisma.colaborador.findUnique({ where: { email } });

    if (!colaborador) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    if (!colaborador.ativo) {
      const pendente = await prisma.reativacaoPedido.findFirst({
        where: { colaboradorId: colaborador.id, status: 'PENDENTE' },
        orderBy: { criadoEm: 'desc' },
      });
      if (pendente) {
        throw new AppError(
          403,
          'Sua conta aguarda aprovação do gestor para reativação.',
          'AGUARDANDO_APROVACAO',
        );
      }
      throw new AppError(
        403,
        'Conta desativada. Solicite a reativação para voltar a acessar.',
        'CONTA_INATIVA',
      );
    }

    if (!colaborador.senhaHash) {
      throw new AppError(401, 'Usuário sem senha cadastrada. Peça ao gestor para definir uma senha.');
    }

    const ok = await bcrypt.compare(senha, colaborador.senhaHash);
    if (!ok) throw new AppError(401, 'Credenciais inválidas');

    const user = {
      id: colaborador.id,
      nome: colaborador.nome,
      email: colaborador.email,
      papel: colaborador.papel,
    };

    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', authRequired, async (req, res, next) => {
  try {
    const col = await prisma.colaborador.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        area: true,
        papel: true,
        ativo: true,
      },
    });
    if (!col || !col.ativo) {
      throw new AppError(401, 'Conta desativada ou não encontrada', 'CONTA_INATIVA');
    }
    res.json(col);
  } catch (e) {
    next(e);
  }
});

/** Lista colaboradores ativos para seletor de sessão (modo demo sem senha) */
authRouter.get('/usuarios-demo', async (_req, res, next) => {
  try {
    const lista = await prisma.colaborador.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, email: true, papel: true, area: true },
      orderBy: { nome: 'asc' },
    });
    res.json(lista);
  } catch (e) {
    next(e);
  }
});

authRouter.patch('/senha', authRequired, async (req, res, next) => {
  try {
    const { senhaAtual, senhaNova } = alterarSenhaSchema.parse(req.body);
    const col = await prisma.colaborador.findUnique({ where: { id: req.user!.id } });
    if (!col || !col.ativo) {
      throw new AppError(401, 'Conta desativada ou não encontrada', 'CONTA_INATIVA');
    }
    if (!col.senhaHash) {
      throw new AppError(400, 'Usuário sem senha cadastrada. Peça ao gestor para definir uma senha.');
    }

    const ok = await bcrypt.compare(senhaAtual, col.senhaHash);
    if (!ok) throw new AppError(400, 'Senha atual incorreta');

    const senhaHash = await bcrypt.hash(senhaNova, 10);
    await prisma.colaborador.update({
      where: { id: col.id },
      data: { senhaHash },
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/desativar-conta', authRequired, async (req, res, next) => {
  try {
    const col = await prisma.colaborador.findUnique({ where: { id: req.user!.id } });
    if (!col) throw new AppError(404, 'Usuário não encontrado');
    if (!col.ativo) throw new AppError(400, 'Conta já está desativada', 'CONTA_INATIVA');

    await prisma.$transaction([
      prisma.colaborador.update({
        where: { id: col.id },
        data: { ativo: false },
      }),
      prisma.reativacaoPedido.updateMany({
        where: { colaboradorId: col.id, status: 'PENDENTE' },
        data: { status: 'RECUSADO', decididoEm: new Date() },
      }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/solicitar-reativacao', async (req, res, next) => {
  try {
    const { email, senhaNova } = solicitarReativacaoSchema.parse(req.body);
    const colaborador = await prisma.colaborador.findUnique({ where: { email } });

    if (!colaborador) {
      throw new AppError(404, 'Não encontramos uma conta com este e-mail.');
    }
    if (colaborador.ativo) {
      throw new AppError(400, 'Esta conta já está ativa. Faça login normalmente.');
    }

    const senhaHashNova = await bcrypt.hash(senhaNova, 10);
    const pendente = await prisma.reativacaoPedido.findFirst({
      where: { colaboradorId: colaborador.id, status: 'PENDENTE' },
      orderBy: { criadoEm: 'desc' },
    });

    if (pendente) {
      await prisma.reativacaoPedido.update({
        where: { id: pendente.id },
        data: { senhaHashNova },
      });
    } else {
      await prisma.reativacaoPedido.create({
        data: {
          colaboradorId: colaborador.id,
          senhaHashNova,
          status: 'PENDENTE',
        },
      });
    }

    res.json({
      status: 'AGUARDANDO_APROVACAO',
      message: 'Pedido de reativação enviado. Aguarde a aprovação do gestor.',
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/reativacoes', authRequired, requirePapel('GESTOR'), async (_req, res, next) => {
  try {
    const lista = await prisma.reativacaoPedido.findMany({
      where: { status: 'PENDENTE' },
      orderBy: { criadoEm: 'asc' },
      include: {
        colaborador: {
          select: {
            id: true,
            nome: true,
            email: true,
            cargo: true,
            area: true,
            papel: true,
            ativo: true,
          },
        },
      },
    });
    res.json(lista);
  } catch (e) {
    next(e);
  }
});

authRouter.post(
  '/reativacoes/:id/aprovar',
  authRequired,
  requirePapel('GESTOR'),
  async (req, res, next) => {
    try {
      const id = param(req.params.id);
      const pedido = await prisma.reativacaoPedido.findUnique({
        where: { id },
        include: { colaborador: true },
      });
      if (!pedido) throw new AppError(404, 'Pedido de reativação não encontrado');
      if (pedido.status !== 'PENDENTE') {
        throw new AppError(400, 'Este pedido já foi decidido');
      }

      await prisma.$transaction(async (tx) => {
        await tx.colaborador.update({
          where: { id: pedido.colaboradorId },
          data: {
            ativo: true,
            ...(pedido.senhaHashNova ? { senhaHash: pedido.senhaHashNova } : {}),
          },
        });
        await tx.reativacaoPedido.update({
          where: { id: pedido.id },
          data: {
            status: 'APROVADO',
            decididoEm: new Date(),
            decididoPorId: req.user!.id,
          },
        });
        await tx.reativacaoPedido.updateMany({
          where: {
            colaboradorId: pedido.colaboradorId,
            status: 'PENDENTE',
            id: { not: pedido.id },
          },
          data: {
            status: 'RECUSADO',
            decididoEm: new Date(),
            decididoPorId: req.user!.id,
          },
        });
      });

      res.json({ ok: true, status: 'APROVADO' });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.post(
  '/reativacoes/:id/recusar',
  authRequired,
  requirePapel('GESTOR'),
  async (req, res, next) => {
    try {
      const id = param(req.params.id);
      const pedido = await prisma.reativacaoPedido.findUnique({ where: { id } });
      if (!pedido) throw new AppError(404, 'Pedido de reativação não encontrado');
      if (pedido.status !== 'PENDENTE') {
        throw new AppError(400, 'Este pedido já foi decidido');
      }

      await prisma.reativacaoPedido.update({
        where: { id },
        data: {
          status: 'RECUSADO',
          decididoEm: new Date(),
          decididoPorId: req.user!.id,
        },
      });

      res.json({ ok: true, status: 'RECUSADO' });
    } catch (e) {
      next(e);
    }
  },
);

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { loginSchema } from '../../lib/schemas.js';
import { authRequired, signToken } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);
    const colaborador = await prisma.colaborador.findUnique({ where: { email } });
    if (!colaborador || !colaborador.ativo) {
      throw new AppError(401, 'Credenciais inválidas');
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
    if (!col) throw new AppError(401, 'Usuário não encontrado');
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

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Papel } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, papel: user.papel, nome: user.nome },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export async function authOptional(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const headerId = req.headers['x-colaborador-id'];

    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as {
        sub: string;
        email: string;
        papel: Papel;
        nome: string;
      };
      req.user = {
        id: payload.sub,
        email: payload.email,
        papel: payload.papel,
        nome: payload.nome,
      };
      return next();
    }

    if (typeof headerId === 'string' && headerId.length > 0) {
      const col = await prisma.colaborador.findUnique({ where: { id: headerId } });
      if (col && col.ativo) {
        req.user = {
          id: col.id,
          nome: col.nome,
          email: col.email,
          papel: col.papel,
        };
      }
    }

    return next();
  } catch {
    return next();
  }
}

export async function authRequired(req: Request, _res: Response, next: NextFunction) {
  await authOptional(req, _res, () => undefined);

  if (!req.user) {
    // Fallback de desenvolvimento: primeiro gestor ativo
    const gestor = await prisma.colaborador.findFirst({
      where: { ativo: true, papel: 'GESTOR' },
    });
    if (gestor) {
      req.user = {
        id: gestor.id,
        nome: gestor.nome,
        email: gestor.email,
        papel: gestor.papel,
      };
      return next();
    }
    return next(new AppError(401, 'Não autenticado'));
  }
  return next();
}

export function requirePapel(...papeis: Papel[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Não autenticado'));
    if (!papeis.includes(req.user.papel)) {
      return next(new AppError(403, 'Sem permissão para esta ação'));
    }
    return next();
  };
}

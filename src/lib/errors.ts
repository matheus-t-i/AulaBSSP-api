import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }

  if (err instanceof ZodError) {
    const first = err.issues[0]?.message ?? 'Dados inválidos';
    return res.status(400).json({
      error: first,
      details: err.flatten(),
    });
  }

  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

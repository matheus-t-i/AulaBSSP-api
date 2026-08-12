import express from 'express';
import cors from 'cors';
import { errorHandler } from './lib/errors.js';
import { authOptional } from './middleware/auth.js';
import { colaboradoresRouter } from './modules/colaboradores/routes.js';
import { clientesRouter } from './modules/clientes/routes.js';
import { obrigacoesRouter } from './modules/obrigacoes/routes.js';
import { tarefasRouter } from './modules/tarefas/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { authRouter } from './modules/auth/routes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(authOptional);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'agenda-fiscal-api' });
  });

  app.use('/auth', authRouter);
  app.use('/colaboradores', colaboradoresRouter);
  app.use('/clientes', clientesRouter);
  app.use('/obrigacoes', obrigacoesRouter);
  app.use('/tarefas', tarefasRouter);
  app.use('/dashboard', dashboardRouter);

  app.use(errorHandler);
  return app;
}

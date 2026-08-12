import { Router } from 'express';
import type { Prisma, StatusTarefa } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { updateResponsavelSchema, updateStatusSchema } from '../../lib/schemas.js';
import { authRequired, requirePapel } from '../../middleware/auth.js';
import { gerarTarefasCompetencias } from '../../domain/geracao.js';
import { calcularSemaforo, isAtrasada, estimarMulta } from '../../domain/risco.js';
import { hojeDateOnly } from '../../domain/vencimento.js';

export const tarefasRouter = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'evidencias');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const includeTarefa = {
  responsavel: { select: { id: true, nome: true, area: true } },
  clienteObrigacao: {
    include: {
      cliente: { select: { id: true, razaoSocial: true, cnpj: true, uf: true, municipio: true } },
      obrigacao: true,
    },
  },
} satisfies Prisma.TarefaInclude;

function parseStatusBody(req: {
  body: Record<string, unknown>;
  file?: Express.Multer.File;
}) {
  const body = {
    status: req.body.status,
    protocolo: req.body.protocolo ?? null,
    observacao: req.body.observacao ?? null,
    evidenciaDescricao: req.body.evidenciaDescricao ?? null,
  };
  return updateStatusSchema.parse(body);
}

tarefasRouter.get('/', authRequired, async (req, res, next) => {
  try {
    const {
      competencia,
      responsavelId,
      clienteId,
      status,
      area,
      risco,
      mes,
      ano,
    } = req.query;

    const where: Prisma.TarefaWhereInput = {};

    if (competencia) where.competencia = String(competencia);
    if (responsavelId) where.responsavelId = String(responsavelId);
    if (status) where.status = String(status) as StatusTarefa;

    if (clienteId || area) {
      where.clienteObrigacao = {
        ...(clienteId ? { clienteId: String(clienteId) } : {}),
        ...(area ? { obrigacao: { area: String(area) as never } } : {}),
      };
    }

    if (mes && ano) {
      const m = Number(mes);
      const a = Number(ano);
      const inicio = new Date(a, m - 1, 1);
      const fim = new Date(a, m, 0);
      where.dataVencimento = { gte: inicio, lte: fim };
    }

    // Colaborador só vê as próprias tarefas
    if (req.user?.papel === 'COLABORADOR') {
      where.responsavelId = req.user.id;
    }

    const tarefas = await prisma.tarefa.findMany({
      where,
      include: includeTarefa,
      orderBy: [{ dataVencimento: 'asc' }, { prioridade: 'desc' }],
    });

    const feriados = await prisma.feriado.findMany();
    const feriadosInfo = feriados.map((f) => ({
      data: f.data,
      abrangencia: f.abrangencia,
      uf: f.uf,
      municipio: f.municipio,
    }));

    let resultado = tarefas.map((t) => {
      const atrasada = isAtrasada(t.status, t.dataVencimento);
      const semaforo = calcularSemaforo(t.status, t.dataVencimento, undefined, feriadosInfo);
      const multaEstimada = atrasada
        ? estimarMulta({
            multaBase: Number(t.clienteObrigacao.obrigacao.multaBase),
            multaPercentual: Number(t.clienteObrigacao.obrigacao.multaPercentual),
            criticidade: t.clienteObrigacao.obrigacao.criticidade,
          })
        : 0;

      return { ...t, atrasada, semaforo, multaEstimada };
    });

    if (risco === 'atrasadas') {
      resultado = resultado.filter((t) => t.atrasada);
    } else if (risco === 'criticos') {
      resultado = resultado.filter((t) => t.semaforo === 'PRETO' || t.semaforo === 'VERMELHO');
    }

    res.json(resultado);
  } catch (e) {
    next(e);
  }
});

tarefasRouter.post('/gerar', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const horizonte = Number(req.body?.horizonteMeses ?? 3);
    const resultado = await gerarTarefasCompetencias(prisma, horizonte);
    res.json(resultado);
  } catch (e) {
    next(e);
  }
});

function paramId(req: { params: { id?: string | string[] } }) {
  return String(req.params.id);
}

tarefasRouter.get('/:id', authRequired, async (req, res, next) => {
  try {
    const tarefa = await prisma.tarefa.findUnique({
      where: { id: paramId(req) },
      include: {
        ...includeTarefa,
        eventos: {
          orderBy: { criadoEm: 'asc' },
          include: { autor: { select: { id: true, nome: true } } },
        },
      },
    });
    if (!tarefa) throw new AppError(404, 'Tarefa não encontrada');
    res.json(tarefa);
  } catch (e) {
    next(e);
  }
});

tarefasRouter.get('/:id/evidencia', authRequired, async (req, res, next) => {
  try {
    const id = paramId(req);
    const tarefa = await prisma.tarefa.findUnique({ where: { id } });
    if (!tarefa) throw new AppError(404, 'Tarefa não encontrada');

    if (
      req.user?.papel === 'COLABORADOR' &&
      tarefa.responsavelId !== req.user.id
    ) {
      throw new AppError(403, 'Acesso negado à evidência desta tarefa');
    }

    if (!tarefa.evidenciaCaminho || !tarefa.evidenciaNomeArquivo) {
      throw new AppError(404, 'Esta tarefa não possui evidência anexada');
    }

    const filePath = path.resolve(tarefa.evidenciaCaminho);
    if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
      throw new AppError(404, 'Arquivo de evidência não encontrado');
    }

    res.download(filePath, tarefa.evidenciaNomeArquivo);
  } catch (e) {
    next(e);
  }
});

tarefasRouter.patch(
  '/:id/status',
  authRequired,
  upload.single('arquivo'),
  async (req, res, next) => {
    try {
      const id = paramId(req);
      const data = parseStatusBody(req);
      const tarefa = await prisma.tarefa.findUnique({ where: { id } });
      if (!tarefa) throw new AppError(404, 'Tarefa não encontrada');

      if (
        req.user?.papel === 'COLABORADOR' &&
        tarefa.responsavelId !== req.user.id
      ) {
        throw new AppError(403, 'Você só pode alterar suas próprias tarefas');
      }

      if (data.status === 'CONCLUIDA') {
        const jaTemEvidencia = Boolean(tarefa.evidenciaCaminho && tarefa.evidenciaDescricao);
        if (!req.file && !jaTemEvidencia) {
          throw new AppError(400, 'Anexe um arquivo de evidência para concluir a tarefa');
        }
        if (!data.evidenciaDescricao?.trim() && !tarefa.evidenciaDescricao) {
          throw new AppError(400, 'Informe a descrição da evidência para concluir a tarefa');
        }
      }

      const dataConclusao =
        data.status === 'CONCLUIDA' ? hojeDateOnly() : data.status === 'DISPENSADA' ? null : null;

      const evidenciaUpdate =
        data.status === 'CONCLUIDA'
          ? {
              evidenciaDescricao:
                data.evidenciaDescricao?.trim() || tarefa.evidenciaDescricao,
              ...(req.file
                ? {
                    evidenciaNomeArquivo: req.file.originalname,
                    evidenciaMimeType: req.file.mimetype,
                    evidenciaCaminho: req.file.path,
                  }
                : {}),
            }
          : {};

      // Remove arquivo antigo se um novo foi enviado
      if (req.file && tarefa.evidenciaCaminho && fs.existsSync(tarefa.evidenciaCaminho)) {
        try {
          fs.unlinkSync(tarefa.evidenciaCaminho);
        } catch {
          /* ignore */
        }
      }

      const updated = await prisma.tarefa.update({
        where: { id: tarefa.id },
        data: {
          status: data.status,
          protocolo: data.protocolo ?? tarefa.protocolo,
          observacao: data.observacao ?? tarefa.observacao,
          dataConclusao: data.status === 'CONCLUIDA' ? dataConclusao : null,
          ...evidenciaUpdate,
          eventos: {
            create: {
              statusAnterior: tarefa.status,
              statusNovo: data.status,
              autorId: req.user?.id,
              observacao:
                data.status === 'CONCLUIDA'
                  ? data.evidenciaDescricao?.trim() || data.observacao
                  : data.observacao,
            },
          },
        },
        include: includeTarefa,
      });

      res.json(updated);
    } catch (e) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }
      next(e);
    }
  },
);

tarefasRouter.patch('/:id/responsavel', authRequired, requirePapel('GESTOR'), async (req, res, next) => {
  try {
    const data = updateResponsavelSchema.parse(req.body);
    const tarefa = await prisma.tarefa.findUnique({ where: { id: paramId(req) } });
    if (!tarefa) throw new AppError(404, 'Tarefa não encontrada');

    const updated = await prisma.tarefa.update({
      where: { id: tarefa.id },
      data: {
        responsavelId: data.responsavelId,
        eventos: {
          create: {
            statusAnterior: tarefa.status,
            statusNovo: tarefa.status,
            responsavelAnteriorId: tarefa.responsavelId,
            responsavelNovoId: data.responsavelId,
            autorId: req.user?.id,
            observacao: data.observacao ?? 'Responsável alterado',
          },
        },
      },
      include: includeTarefa,
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

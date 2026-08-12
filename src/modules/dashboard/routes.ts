import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authRequired } from '../../middleware/auth.js';
import { calcularSemaforo, isAtrasada, estimarMulta } from '../../domain/risco.js';
import { calcularCarga, montarKpiColaborador } from '../../domain/rendimento.js';
import {
  formatCompetencia,
  competenciaAtual,
  parseCompetencia,
  adicionarMesesCompetencia,
} from '../../domain/vencimento.js';
import { toDateOnlyKey } from '../../lib/dateOnly.js';

export const dashboardRouter = Router();

dashboardRouter.get('/resumo', authRequired, async (req, res, next) => {
  try {
    const where: Prisma.TarefaWhereInput =
      req.user?.papel === 'COLABORADOR' ? { responsavelId: req.user.id } : {};

    const tarefas = await prisma.tarefa.findMany({
      where,
      include: {
        clienteObrigacao: { include: { obrigacao: true, cliente: true } },
      },
    });

    const feriados = await prisma.feriado.findMany();
    const feriadosInfo = feriados.map((f) => ({
      data: f.data,
      abrangencia: f.abrangencia,
      uf: f.uf,
      municipio: f.municipio,
    }));

    let atrasadas = 0;
    let vencendoHoje = 0;
    let emAndamento = 0;
    let concluidas = 0;
    let exposicaoMulta = 0;

    for (const t of tarefas) {
      const semaforo = calcularSemaforo(t.status, t.dataVencimento, undefined, feriadosInfo);
      if (isAtrasada(t.status, t.dataVencimento)) {
        atrasadas += 1;
        exposicaoMulta += estimarMulta({
          multaBase: Number(t.clienteObrigacao.obrigacao.multaBase),
          multaPercentual: Number(t.clienteObrigacao.obrigacao.multaPercentual),
          criticidade: t.clienteObrigacao.obrigacao.criticidade,
        });
      }
      if (semaforo === 'VERMELHO') vencendoHoje += 1;
      if (t.status === 'EM_ANDAMENTO') emAndamento += 1;
      if (t.status === 'CONCLUIDA') concluidas += 1;
    }

    res.json({
      total: tarefas.length,
      atrasadas,
      vencendoHoje,
      emAndamento,
      concluidas,
      exposicaoMulta: Math.round(exposicaoMulta * 100) / 100,
      pendentes: tarefas.filter((t) => t.status === 'PENDENTE').length,
    });
  } catch (e) {
    next(e);
  }
});

dashboardRouter.get('/agenda', authRequired, async (req, res, next) => {
  try {
    const mes = Number(req.query.mes ?? new Date().getMonth() + 1);
    const ano = Number(req.query.ano ?? new Date().getFullYear());
    const area = req.query.area ? String(req.query.area) : undefined;
    const clienteId = req.query.clienteId ? String(req.query.clienteId) : undefined;
    const responsavelId = req.query.responsavelId
      ? String(req.query.responsavelId)
      : undefined;

    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);

    const where: Prisma.TarefaWhereInput = {
      dataVencimento: { gte: inicio, lte: fim },
      ...(req.user?.papel === 'COLABORADOR'
        ? { responsavelId: req.user.id }
        : responsavelId
          ? { responsavelId }
          : {}),
      ...((clienteId || area)
        ? {
            clienteObrigacao: {
              ...(clienteId ? { clienteId } : {}),
              ...(area ? { obrigacao: { area: area as never } } : {}),
            },
          }
        : {}),
    };

    const tarefas = await prisma.tarefa.findMany({
      where,
      include: {
        responsavel: { select: { id: true, nome: true } },
        clienteObrigacao: {
          include: {
            cliente: { select: { id: true, razaoSocial: true } },
            obrigacao: true,
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
    });

    const feriados = await prisma.feriado.findMany();
    const feriadosInfo = feriados.map((f) => ({
      data: f.data,
      abrangencia: f.abrangencia,
      uf: f.uf,
      municipio: f.municipio,
    }));

    const porDia: Record<
      string,
      { data: string; total: number; pretos: number; vermelhos: number; amarelos: number; verdes: number; cinzas: number }
    > = {};

    const enriquecidas = tarefas.map((t) => {
      const semaforo = calcularSemaforo(t.status, t.dataVencimento, undefined, feriadosInfo);
      const key = toDateOnlyKey(t.dataVencimento);
      if (!porDia[key]) {
        porDia[key] = {
          data: key,
          total: 0,
          pretos: 0,
          vermelhos: 0,
          amarelos: 0,
          verdes: 0,
          cinzas: 0,
        };
      }
      porDia[key].total += 1;
      if (semaforo === 'PRETO') porDia[key].pretos += 1;
      else if (semaforo === 'VERMELHO') porDia[key].vermelhos += 1;
      else if (semaforo === 'AMARELO') porDia[key].amarelos += 1;
      else if (semaforo === 'VERDE') porDia[key].verdes += 1;
      else porDia[key].cinzas += 1;

      return {
        ...t,
        semaforo,
        atrasada: isAtrasada(t.status, t.dataVencimento),
      };
    });

    res.json({
      mes,
      ano,
      dias: Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)),
      tarefas: enriquecidas,
    });
  } catch (e) {
    next(e);
  }
});

dashboardRouter.get('/atrasos', authRequired, async (req, res, next) => {
  try {
    const where: Prisma.TarefaWhereInput =
      req.user?.papel === 'COLABORADOR' ? { responsavelId: req.user.id } : {};

    const tarefas = await prisma.tarefa.findMany({
      where: {
        ...where,
        status: { notIn: ['CONCLUIDA', 'DISPENSADA'] },
      },
      include: {
        responsavel: { select: { id: true, nome: true } },
        clienteObrigacao: {
          include: {
            cliente: { select: { id: true, razaoSocial: true, cnpj: true } },
            obrigacao: true,
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
    });

    const atrasadas = tarefas
      .filter((t) => isAtrasada(t.status, t.dataVencimento))
      .map((t) => {
        const multaEstimada = estimarMulta({
          multaBase: Number(t.clienteObrigacao.obrigacao.multaBase),
          multaPercentual: Number(t.clienteObrigacao.obrigacao.multaPercentual),
          criticidade: t.clienteObrigacao.obrigacao.criticidade,
        });
        return { ...t, semaforo: 'PRETO' as const, atrasada: true, multaEstimada };
      });

    const porCliente = new Map<
      string,
      { clienteId: string; razaoSocial: string; qtd: number; exposicao: number; tarefas: typeof atrasadas }
    >();

    for (const t of atrasadas) {
      const c = t.clienteObrigacao.cliente;
      const atual = porCliente.get(c.id) ?? {
        clienteId: c.id,
        razaoSocial: c.razaoSocial,
        qtd: 0,
        exposicao: 0,
        tarefas: [],
      };
      atual.qtd += 1;
      atual.exposicao += t.multaEstimada;
      atual.tarefas.push(t);
      porCliente.set(c.id, atual);
    }

    const ranking = [...porCliente.values()]
      .map((r) => ({ ...r, exposicao: Math.round(r.exposicao * 100) / 100 }))
      .sort((a, b) => b.exposicao - a.exposicao);

    res.json({
      totalAtrasadas: atrasadas.length,
      exposicaoTotal: Math.round(atrasadas.reduce((s, t) => s + t.multaEstimada, 0) * 100) / 100,
      ranking,
      tarefas: atrasadas,
    });
  } catch (e) {
    next(e);
  }
});

dashboardRouter.get('/rendimento', authRequired, async (req, res, next) => {
  try {
    const competenciaRaw =
      (req.query.competencia as string) ||
      formatCompetencia(competenciaAtual().ano, competenciaAtual().mes);

    let competenciaBase;
    try {
      competenciaBase = parseCompetencia(competenciaRaw);
    } catch {
      return res.status(400).json({ error: 'Competência inválida. Use AAAA-MM.' });
    }
    const competencia = formatCompetencia(competenciaBase.ano, competenciaBase.mes);

    const colaboradores = await prisma.colaborador.findMany({
      where: {
        ativo: true,
        ...(req.user?.papel === 'COLABORADOR' ? { id: req.user.id } : {}),
      },
      orderBy: { nome: 'asc' },
    });

    const ranking = [];

    for (const col of colaboradores) {
      const tarefas = await prisma.tarefa.findMany({
        where: { responsavelId: col.id },
        include: {
          eventos: { orderBy: { criadoEm: 'asc' } },
        },
      });

      // KPIs de entrega (pontualidade, volume, atraso, ciclo) filtrados pela competência
      const daCompetencia = tarefas.filter((t) => t.competencia === competencia);
      const kpiCompetencia = montarKpiColaborador(
        daCompetencia.map((t) => ({
          status: t.status,
          dataVencimento: t.dataVencimento,
          dataConclusao: t.dataConclusao,
          esforcoEstimado: t.esforcoEstimado,
          eventos: t.eventos,
        })),
        col.capacidadeMensal,
      );

      // Carga é snapshot atual (tarefas abertas), não histórica da competência
      const abertas = tarefas.filter(
        (t) => t.status !== 'CONCLUIDA' && t.status !== 'DISPENSADA',
      );
      const carga = calcularCarga(abertas, col.capacidadeMensal);

      ranking.push({
        colaborador: {
          id: col.id,
          nome: col.nome,
          area: col.area,
          cargo: col.cargo,
        },
        competencia,
        pontualidade: kpiCompetencia.pontualidade,
        volumeEntregue: kpiCompetencia.volumeEntregue,
        volumeCompetencia: kpiCompetencia.volumeEntregue,
        atrasoMedioDias: kpiCompetencia.atrasoMedioDias,
        tempoMedioCicloHoras: kpiCompetencia.tempoMedioCicloHoras,
        capacidadeMensal: col.capacidadeMensal,
        ...carga,
      });
    }

    // Melhor → pior: pontualidade primária, volume no mês como desempate
    ranking.sort(
      (a, b) =>
        b.pontualidade - a.pontualidade || b.volumeCompetencia - a.volumeCompetencia,
    );

    // Série dos 6 meses terminando na competência selecionada
    const serieMensal: Array<{ competencia: string; pontualidadeMedia: number; volume: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const c = adicionarMesesCompetencia(competenciaBase, -i);
      const comp = formatCompetencia(c.ano, c.mes);
      const tarefasComp = await prisma.tarefa.findMany({
        where: {
          competencia: comp,
          status: 'CONCLUIDA',
          ...(req.user?.papel === 'COLABORADOR' ? { responsavelId: req.user.id } : {}),
        },
      });
      const noPrazo = tarefasComp.filter(
        (t) => t.dataConclusao && t.dataConclusao <= t.dataVencimento,
      ).length;
      serieMensal.push({
        competencia: comp,
        pontualidadeMedia:
          tarefasComp.length === 0 ? 100 : Math.round((noPrazo / tarefasComp.length) * 1000) / 10,
        volume: tarefasComp.length,
      });
    }

    res.json({ ranking, serieMensal, competencia });
  } catch (e) {
    next(e);
  }
});

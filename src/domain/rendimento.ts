import type { StatusTarefa } from '@prisma/client';
import { differenceInCalendarDays } from 'date-fns';
import { hojeDateOnly } from './vencimento.js';

export type TarefaRendimento = {
  status: StatusTarefa;
  dataVencimento: Date;
  dataConclusao: Date | null;
  esforcoEstimado: number;
  eventos?: Array<{
    statusNovo: StatusTarefa | null;
    criadoEm: Date;
  }>;
};

export type KpiColaborador = {
  totalConcluidas: number;
  concluidasNoPrazo: number;
  pontualidade: number;
  atrasoMedioDias: number;
  volumeEntregue: number;
  cargaAtual: number;
  capacidadeMensal: number;
  percentualCarga: number;
  tempoMedioCicloHoras: number | null;
};

export function calcularPontualidade(tarefas: TarefaRendimento[]): {
  totalConcluidas: number;
  concluidasNoPrazo: number;
  pontualidade: number;
  atrasoMedioDias: number;
} {
  const concluidas = tarefas.filter((t) => t.status === 'CONCLUIDA' && t.dataConclusao);
  const noPrazo = concluidas.filter(
    (t) => hojeDateOnly(t.dataConclusao!) <= hojeDateOnly(t.dataVencimento),
  );

  const atrasos = concluidas
    .map((t) => differenceInCalendarDays(hojeDateOnly(t.dataConclusao!), hojeDateOnly(t.dataVencimento)))
    .filter((d) => d > 0);

  const atrasoMedio =
    atrasos.length === 0 ? 0 : Math.round((atrasos.reduce((a, b) => a + b, 0) / atrasos.length) * 10) / 10;

  return {
    totalConcluidas: concluidas.length,
    concluidasNoPrazo: noPrazo.length,
    pontualidade:
      concluidas.length === 0
        ? 100
        : Math.round((noPrazo.length / concluidas.length) * 1000) / 10,
    atrasoMedioDias: atrasoMedio,
  };
}

export function calcularCarga(
  tarefasAbertas: Array<{ esforcoEstimado: number }>,
  capacidadeMensal: number,
): { cargaAtual: number; percentualCarga: number } {
  const cargaAtual = tarefasAbertas.reduce((s, t) => s + t.esforcoEstimado, 0);
  const percentualCarga =
    capacidadeMensal <= 0 ? 0 : Math.round((cargaAtual / capacidadeMensal) * 1000) / 10;
  return { cargaAtual, percentualCarga };
}

export function calcularTempoMedioCicloHoras(
  tarefas: TarefaRendimento[],
): number | null {
  const ciclos: number[] = [];

  for (const t of tarefas) {
    if (t.status !== 'CONCLUIDA' || !t.eventos?.length) continue;
    const inicio = t.eventos.find((e) => e.statusNovo === 'EM_ANDAMENTO');
    const fim = t.eventos.find((e) => e.statusNovo === 'CONCLUIDA');
    if (!inicio || !fim) continue;
    const horas = (fim.criadoEm.getTime() - inicio.criadoEm.getTime()) / (1000 * 60 * 60);
    if (horas >= 0) ciclos.push(horas);
  }

  if (ciclos.length === 0) return null;
  return Math.round((ciclos.reduce((a, b) => a + b, 0) / ciclos.length) * 10) / 10;
}

export function montarKpiColaborador(
  tarefas: TarefaRendimento[],
  capacidadeMensal: number,
): KpiColaborador {
  const pontualidade = calcularPontualidade(tarefas);
  const abertas = tarefas.filter(
    (t) => t.status !== 'CONCLUIDA' && t.status !== 'DISPENSADA',
  );
  const carga = calcularCarga(abertas, capacidadeMensal);

  return {
    ...pontualidade,
    volumeEntregue: pontualidade.totalConcluidas,
    ...carga,
    capacidadeMensal,
    tempoMedioCicloHoras: calcularTempoMedioCicloHoras(tarefas),
  };
}

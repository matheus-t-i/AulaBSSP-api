import type { Criticidade, StatusTarefa } from '@prisma/client';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { diasUteisEntre, hojeDateOnly, isDiaUtil, type FeriadoInfo } from './vencimento.js';

export type Semaforo = 'PRETO' | 'VERMELHO' | 'AMARELO' | 'VERDE' | 'CINZA';

const STATUS_FINAIS: StatusTarefa[] = ['CONCLUIDA', 'DISPENSADA'];

export function isAtrasada(
  status: StatusTarefa,
  dataVencimento: Date,
  referencia?: Date,
): boolean {
  if (STATUS_FINAIS.includes(status)) return false;
  return hojeDateOnly(referencia) > hojeDateOnly(dataVencimento);
}

export function calcularSemaforo(
  status: StatusTarefa,
  dataVencimento: Date,
  referencia?: Date,
  feriados: FeriadoInfo[] = [],
): Semaforo {
  if (STATUS_FINAIS.includes(status)) return 'CINZA';

  const hoje = hojeDateOnly(referencia);
  const venc = hojeDateOnly(dataVencimento);

  if (hoje > venc) return 'PRETO';

  const diasCorridos = differenceInCalendarDays(venc, hoje);
  if (diasCorridos <= 1) return 'VERMELHO';

  // Conta dias úteis restantes (hoje exclusivo até o vencimento)
  const uteis = diasUteisEntre(hoje, venc, feriados);
  if (uteis <= 3) return 'AMARELO';

  return 'VERDE';
}

const PESO_CRITICIDADE: Record<Criticidade, number> = {
  BAIXA: 0.5,
  MEDIA: 1,
  ALTA: 1.5,
  CRITICA: 2,
};

export function estimarMulta(params: {
  multaBase: number | string;
  multaPercentual?: number | string | null;
  criticidade: Criticidade;
  faturamentoEstimado?: number;
}): number {
  const base = Number(params.multaBase) || 0;
  const percentual = Number(params.multaPercentual) || 0;
  const faturamento = params.faturamentoEstimado ?? 0;
  const bruto = base + (faturamento * percentual) / 100;
  return Math.round(bruto * PESO_CRITICIDADE[params.criticidade] * 100) / 100;
}

export function amanha(referencia?: Date): Date {
  return addDays(hojeDateOnly(referencia), 1);
}

export { isDiaUtil };

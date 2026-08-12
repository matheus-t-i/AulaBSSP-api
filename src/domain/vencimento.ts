import {
  addDays,
  addMonths,
  endOfMonth,
  getDate,
  getDaysInMonth,
  isSaturday,
  isSunday,
  setDate,
  startOfDay,
} from 'date-fns';
import type { AjusteDiaNaoUtil, RegraVencimento } from '@prisma/client';

export type Competencia = { ano: number; mes: number };

export type ObrigacaoVencimento = {
  regraVencimento: RegraVencimento;
  dia: number | null;
  mesesDefasagem: number;
  ajusteDiaNaoUtil: AjusteDiaNaoUtil;
};

export type FeriadoInfo = {
  data: Date;
  abrangencia: 'NACIONAL' | 'UF' | 'MUNICIPIO';
  uf?: string | null;
  municipio?: string | null;
};

function toDateOnly(date: Date): Date {
  return startOfDay(date);
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseCompetencia(competencia: string): Competencia {
  const match = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!match) {
    throw new Error(`Competência inválida: ${competencia}. Use AAAA-MM.`);
  }
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (mes < 1 || mes > 12) {
    throw new Error(`Mês inválido na competência: ${competencia}`);
  }
  return { ano, mes };
}

export function formatCompetencia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function competenciaParaDate({ ano, mes }: Competencia): Date {
  return toDateOnly(new Date(ano, mes - 1, 1));
}

export function adicionarMesesCompetencia(competencia: Competencia, meses: number): Competencia {
  const base = competenciaParaDate(competencia);
  const alvo = addMonths(base, meses);
  return { ano: alvo.getFullYear(), mes: alvo.getMonth() + 1 };
}

function feriadosAplicaveis(
  feriados: FeriadoInfo[],
  uf?: string | null,
  municipio?: string | null,
): Set<string> {
  const set = new Set<string>();
  for (const f of feriados) {
    if (f.abrangencia === 'NACIONAL') {
      set.add(dateKey(f.data));
      continue;
    }
    if (f.abrangencia === 'UF' && uf && f.uf === uf) {
      set.add(dateKey(f.data));
      continue;
    }
    if (
      f.abrangencia === 'MUNICIPIO' &&
      uf &&
      municipio &&
      f.uf === uf &&
      f.municipio?.toLowerCase() === municipio.toLowerCase()
    ) {
      set.add(dateKey(f.data));
    }
  }
  return set;
}

export function isDiaUtil(
  date: Date,
  feriados: Set<string> | FeriadoInfo[],
  uf?: string | null,
  municipio?: string | null,
): boolean {
  if (isSaturday(date) || isSunday(date)) return false;
  const set = feriados instanceof Set ? feriados : feriadosAplicaveis(feriados, uf, municipio);
  return !set.has(dateKey(date));
}

export function ajustarDiaNaoUtil(
  date: Date,
  ajuste: AjusteDiaNaoUtil,
  feriados: Set<string>,
): Date {
  if (ajuste === 'MANTER' || isDiaUtil(date, feriados)) {
    return toDateOnly(date);
  }

  let atual = toDateOnly(date);
  if (ajuste === 'ANTECIPAR') {
    while (!isDiaUtil(atual, feriados)) {
      atual = addDays(atual, -1);
    }
    return atual;
  }

  while (!isDiaUtil(atual, feriados)) {
    atual = addDays(atual, 1);
  }
  return atual;
}

function diaFixoNoMes(ano: number, mes: number, dia: number): Date {
  const diasNoMes = getDaysInMonth(new Date(ano, mes - 1, 1));
  const diaAjustado = Math.min(dia, diasNoMes);
  return toDateOnly(new Date(ano, mes - 1, diaAjustado));
}

function nEsimoDiaUtil(ano: number, mes: number, n: number, feriados: Set<string>): Date {
  let atual = toDateOnly(new Date(ano, mes - 1, 1));
  let contagem = 0;
  const fim = endOfMonth(atual);

  while (atual <= fim) {
    if (isDiaUtil(atual, feriados)) {
      contagem += 1;
      if (contagem === n) return atual;
    }
    atual = addDays(atual, 1);
  }

  // Se o mês não tem N dias úteis, usa o último dia útil
  let ultimo = fim;
  while (!isDiaUtil(ultimo, feriados)) {
    ultimo = addDays(ultimo, -1);
  }
  return ultimo;
}

function ultimoDiaUtil(ano: number, mes: number, feriados: Set<string>): Date {
  let atual = toDateOnly(endOfMonth(new Date(ano, mes - 1, 1)));
  while (!isDiaUtil(atual, feriados)) {
    atual = addDays(atual, -1);
  }
  return atual;
}

function ultimoDiaMes(ano: number, mes: number): Date {
  return toDateOnly(endOfMonth(new Date(ano, mes - 1, 1)));
}

export function calcularVencimento(
  obrigacao: ObrigacaoVencimento,
  competencia: Competencia | string,
  feriados: FeriadoInfo[] = [],
  uf?: string | null,
  municipio?: string | null,
): Date {
  const comp = typeof competencia === 'string' ? parseCompetencia(competencia) : competencia;
  const mesVencimento = adicionarMesesCompetencia(comp, obrigacao.mesesDefasagem);
  const feriadoSet = feriadosAplicaveis(feriados, uf, municipio);
  const { ano, mes } = mesVencimento;
  const dia = obrigacao.dia ?? 1;

  let bruto: Date;

  switch (obrigacao.regraVencimento) {
    case 'DIA_FIXO':
      bruto = diaFixoNoMes(ano, mes, dia);
      break;
    case 'DIA_UTIL_N':
      bruto = nEsimoDiaUtil(ano, mes, dia, feriadoSet);
      // DIA_UTIL_N já cai em dia útil; ajuste só se a regra ainda quiser mexer
      return toDateOnly(bruto);
    case 'ULTIMO_DIA_UTIL':
      bruto = ultimoDiaUtil(ano, mes, feriadoSet);
      return toDateOnly(bruto);
    case 'ULTIMO_DIA_MES':
      bruto = ultimoDiaMes(ano, mes);
      break;
    default:
      bruto = diaFixoNoMes(ano, mes, dia);
  }

  return ajustarDiaNaoUtil(bruto, obrigacao.ajusteDiaNaoUtil, feriadoSet);
}

export function diasUteisEntre(
  inicio: Date,
  fim: Date,
  feriados: FeriadoInfo[] = [],
  uf?: string | null,
  municipio?: string | null,
): number {
  const set = feriadosAplicaveis(feriados, uf, municipio);
  let atual = toDateOnly(inicio);
  const alvo = toDateOnly(fim);
  let count = 0;

  if (atual >= alvo) return 0;

  atual = addDays(atual, 1);
  while (atual <= alvo) {
    if (isDiaUtil(atual, set)) count += 1;
    atual = addDays(atual, 1);
  }
  return count;
}

export function hojeDateOnly(referencia?: Date): Date {
  return toDateOnly(referencia ?? new Date());
}

export function competenciaAtual(referencia?: Date): Competencia {
  const d = referencia ?? new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export function listarCompetenciasFuturas(
  quantidade: number,
  referencia?: Date,
): string[] {
  const atual = competenciaAtual(referencia);
  const lista: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    const c = adicionarMesesCompetencia(atual, i);
    lista.push(formatCompetencia(c.ano, c.mes));
  }
  return lista;
}

/** Export helpers usados em testes */
export const __test = {
  dateKey,
  diaFixoNoMes,
  getDate,
  setDate,
};

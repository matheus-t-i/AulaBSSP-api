import { describe, expect, it } from 'vitest';
import {
  ajustarDiaNaoUtil,
  calcularVencimento,
  formatCompetencia,
  isDiaUtil,
  parseCompetencia,
  type FeriadoInfo,
} from '../src/domain/vencimento.js';

const feriados2026: FeriadoInfo[] = [
  { data: new Date(2026, 0, 1), abrangencia: 'NACIONAL' }, // Ano Novo (qui)
  { data: new Date(2026, 3, 3), abrangencia: 'NACIONAL' }, // Sexta Santa
  { data: new Date(2026, 3, 21), abrangencia: 'NACIONAL' }, // Tiradentes
  { data: new Date(2026, 4, 1), abrangencia: 'NACIONAL' }, // Trabalho
  { data: new Date(2026, 8, 7), abrangencia: 'NACIONAL' }, // Independência
  { data: new Date(2026, 9, 12), abrangencia: 'NACIONAL' }, // N. Sra Aparecida
  { data: new Date(2026, 10, 2), abrangencia: 'NACIONAL' }, // Finados
  { data: new Date(2026, 10, 15), abrangencia: 'NACIONAL' }, // Proclamação
  { data: new Date(2026, 11, 25), abrangencia: 'NACIONAL' }, // Natal
];

describe('parseCompetencia', () => {
  it('parseia AAAA-MM', () => {
    expect(parseCompetencia('2026-07')).toEqual({ ano: 2026, mes: 7 });
  });

  it('rejeita formato inválido', () => {
    expect(() => parseCompetencia('07/2026')).toThrow();
  });
});

describe('formatCompetencia', () => {
  it('formata com zero à esquerda', () => {
    expect(formatCompetencia(2026, 7)).toBe('2026-07');
  });
});

describe('calcularVencimento - DIA_FIXO', () => {
  it('DAS: competência 07/2026 com defasagem 1 vence em 20/08/2026', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 20,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'POSTERGAR',
      },
      '2026-07',
      feriados2026,
    );
    expect(venc).toEqual(new Date(2026, 7, 20));
  });

  it('dia 31 em mês de 30 dias usa o último dia do mês', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 31,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'MANTER',
      },
      '2026-03', // vence em abril (30 dias)
      [],
    );
    expect(venc).toEqual(new Date(2026, 3, 30));
  });

  it('fevereiro: dia 30 vira 28 (2026 não é bissexto)', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 30,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'MANTER',
      },
      '2026-01',
      [],
    );
    expect(venc).toEqual(new Date(2026, 1, 28));
  });

  it('virada de ano: competência 11/2026 com defasagem 1 vence em dez/2026', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 15,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'MANTER',
      },
      '2026-11',
      [],
    );
    expect(venc).toEqual(new Date(2026, 11, 15));
  });

  it('virada de ano: competência 12/2026 com defasagem 1 vence em jan/2027', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 20,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'MANTER',
      },
      '2026-12',
      [],
    );
    expect(venc).toEqual(new Date(2027, 0, 20));
  });
});

describe('ajuste dia não útil', () => {
  it('POSTERGAR: sábado vai para segunda', () => {
    // 20/06/2026 é sábado
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 20,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'POSTERGAR',
      },
      '2026-05',
      [],
    );
    expect(venc.getDay()).toBe(1); // segunda
    expect(venc).toEqual(new Date(2026, 5, 22));
  });

  it('ANTECIPAR: sábado volta para sexta', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 20,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'ANTECIPAR',
      },
      '2026-05',
      [],
    );
    expect(venc).toEqual(new Date(2026, 5, 19));
  });

  it('feriado colado em fim de semana: posterga além do feriado', () => {
    // 01/05/2026 é sexta (Dia do Trabalho)
    // Se dia 1 cair em feriado, posterga para dia útil seguinte
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 1,
        mesesDefasagem: 0,
        ajusteDiaNaoUtil: 'POSTERGAR',
      },
      '2026-05',
      feriados2026,
    );
    expect(isDiaUtil(venc, feriados2026)).toBe(true);
    expect(venc).toEqual(new Date(2026, 4, 4)); // segunda após 1º (sex) e fim de semana
  });

  it('MANTER não move mesmo em domingo', () => {
    // 25/10/2026 é domingo
    const resultado = ajustarDiaNaoUtil(
      new Date(2026, 9, 25),
      'MANTER',
      new Set(),
    );
    expect(resultado).toEqual(new Date(2026, 9, 25));
  });
});

describe('DIA_UTIL_N', () => {
  it('15º dia útil de agosto/2026', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'DIA_UTIL_N',
        dia: 15,
        mesesDefasagem: 1,
        ajusteDiaNaoUtil: 'POSTERGAR',
      },
      '2026-07',
      feriados2026,
    );
    expect(isDiaUtil(venc, feriados2026)).toBe(true);
    // Conta 15 dias úteis a partir de 01/08/2026
    expect(venc.getMonth()).toBe(7);
  });
});

describe('ULTIMO_DIA_UTIL e ULTIMO_DIA_MES', () => {
  it('último dia útil de fevereiro/2026', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'ULTIMO_DIA_UTIL',
        dia: null,
        mesesDefasagem: 0,
        ajusteDiaNaoUtil: 'MANTER',
      },
      '2026-02',
      feriados2026,
    );
    // 28/02/2026 é sábado → último útil é 27/02 (sexta)
    expect(venc).toEqual(new Date(2026, 1, 27));
  });

  it('último dia do mês sem ajuste', () => {
    const venc = calcularVencimento(
      {
        regraVencimento: 'ULTIMO_DIA_MES',
        dia: null,
        mesesDefasagem: 0,
        ajusteDiaNaoUtil: 'MANTER',
      },
      '2026-02',
      [],
    );
    expect(venc).toEqual(new Date(2026, 1, 28));
  });
});

describe('feriados regionais', () => {
  it('considera feriado municipal do cliente', () => {
    const feriados: FeriadoInfo[] = [
      {
        data: new Date(2026, 0, 20),
        abrangencia: 'MUNICIPIO',
        uf: 'SP',
        municipio: 'São Paulo',
      },
    ];

    const vencSP = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 20,
        mesesDefasagem: 0,
        ajusteDiaNaoUtil: 'POSTERGAR',
      },
      '2026-01',
      feriados,
      'SP',
      'São Paulo',
    );

    const vencRJ = calcularVencimento(
      {
        regraVencimento: 'DIA_FIXO',
        dia: 20,
        mesesDefasagem: 0,
        ajusteDiaNaoUtil: 'POSTERGAR',
      },
      '2026-01',
      feriados,
      'RJ',
      'Rio de Janeiro',
    );

    expect(vencSP).toEqual(new Date(2026, 0, 21));
    expect(vencRJ).toEqual(new Date(2026, 0, 20));
  });
});

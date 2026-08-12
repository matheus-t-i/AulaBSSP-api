import 'dotenv/config';
import 'dotenv/config';
import {
  PrismaClient,
  RegimeTributario,
  Area,
  Esfera,
  Periodicidade,
  RegraVencimento,
  AjusteDiaNaoUtil,
  Criticidade,
  Papel,
  StatusTarefa,
  AbrangenciaFeriado,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, subDays, subMonths } from 'date-fns';
import { calcularVencimento, formatCompetencia, type FeriadoInfo } from '../src/domain/vencimento.js';

const prisma = new PrismaClient();
let SENHA_DEMO = '';

async function limpar() {
  await prisma.tarefaEvento.deleteMany();
  await prisma.tarefa.deleteMany();
  await prisma.clienteObrigacao.deleteMany();
  await prisma.obrigacao.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.colaborador.deleteMany();
  await prisma.feriado.deleteMany();
}

async function seedFeriados() {
  const nacionais: Array<{ data: Date; nome: string }> = [
    { data: new Date(2025, 0, 1), nome: 'Confraternização Universal' },
    { data: new Date(2025, 3, 18), nome: 'Sexta-feira Santa' },
    { data: new Date(2025, 3, 21), nome: 'Tiradentes' },
    { data: new Date(2025, 4, 1), nome: 'Dia do Trabalho' },
    { data: new Date(2025, 8, 7), nome: 'Independência do Brasil' },
    { data: new Date(2025, 9, 12), nome: 'Nossa Senhora Aparecida' },
    { data: new Date(2025, 10, 2), nome: 'Finados' },
    { data: new Date(2025, 10, 15), nome: 'Proclamação da República' },
    { data: new Date(2025, 11, 25), nome: 'Natal' },
    { data: new Date(2026, 0, 1), nome: 'Confraternização Universal' },
    { data: new Date(2026, 3, 3), nome: 'Sexta-feira Santa' },
    { data: new Date(2026, 3, 21), nome: 'Tiradentes' },
    { data: new Date(2026, 4, 1), nome: 'Dia do Trabalho' },
    { data: new Date(2026, 8, 7), nome: 'Independência do Brasil' },
    { data: new Date(2026, 9, 12), nome: 'Nossa Senhora Aparecida' },
    { data: new Date(2026, 10, 2), nome: 'Finados' },
    { data: new Date(2026, 10, 15), nome: 'Proclamação da República' },
    { data: new Date(2026, 11, 25), nome: 'Natal' },
  ];

  for (const f of nacionais) {
    await prisma.feriado.create({
      data: {
        data: f.data,
        nome: f.nome,
        abrangencia: AbrangenciaFeriado.NACIONAL,
      },
    });
  }

  await prisma.feriado.create({
    data: {
      data: new Date(2026, 0, 25),
      nome: 'Aniversário de São Paulo',
      abrangencia: AbrangenciaFeriado.MUNICIPIO,
      uf: 'SP',
      municipio: 'São Paulo',
    },
  });
}

async function seedObrigacoes() {
  const itens = [
    {
      codigo: 'DAS',
      nome: 'DAS - Simples Nacional',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 20,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.CRITICA,
      multaBase: 50,
      multaPercentual: 0.33,
      baseLegal: 'LC 123/2006',
      regimesAplicaveis: [RegimeTributario.SIMPLES, RegimeTributario.MEI],
    },
    {
      codigo: 'DASN-SIMEI',
      nome: 'DASN-SIMEI - Declaração Anual do MEI',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.ANUAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 31,
      mesesDefasagem: 5, // competência ano anterior → maio
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.ALTA,
      multaBase: 50,
      multaPercentual: 0,
      baseLegal: 'LC 123/2006',
      regimesAplicaveis: [RegimeTributario.MEI],
    },
    {
      codigo: 'DCTFWEB',
      nome: 'DCTFWeb',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_UTIL_N,
      dia: 15,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.CRITICA,
      multaBase: 500,
      multaPercentual: 0,
      baseLegal: 'IN RFB 2005/2021',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL, RegimeTributario.SIMPLES],
      requerFolha: true,
    },
    {
      codigo: 'EFD-CONTRIB',
      nome: 'EFD-Contribuições',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_UTIL_N,
      dia: 10,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.ALTA,
      multaBase: 500,
      multaPercentual: 0,
      baseLegal: 'IN RFB 1252/2012',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL],
    },
    {
      codigo: 'EFD-REINF',
      nome: 'EFD-Reinf',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_UTIL_N,
      dia: 15,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.ALTA,
      multaBase: 500,
      multaPercentual: 0,
      baseLegal: 'IN RFB 2043/2021',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL, RegimeTributario.SIMPLES],
    },
    {
      codigo: 'EFD-ICMS',
      nome: 'EFD-ICMS/IPI',
      area: Area.FISCAL,
      esfera: Esfera.ESTADUAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 25,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.ALTA,
      multaBase: 300,
      multaPercentual: 0,
      baseLegal: 'Convênio ICMS 77/2017',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL, RegimeTributario.SIMPLES],
    },
    {
      codigo: 'ESOCIAL',
      nome: 'eSocial - Folha de Pagamento',
      area: Area.DP,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_UTIL_N,
      dia: 15,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.CRITICA,
      multaBase: 1812.87,
      multaPercentual: 0,
      baseLegal: 'Decreto 8373/2014',
      regimesAplicaveis: [
        RegimeTributario.MEI,
        RegimeTributario.SIMPLES,
        RegimeTributario.PRESUMIDO,
        RegimeTributario.REAL,
      ],
      requerFolha: true,
    },
    {
      codigo: 'FGTS-DIG',
      nome: 'FGTS Digital',
      area: Area.DP,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_UTIL_N,
      dia: 20,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.CRITICA,
      multaBase: 100,
      multaPercentual: 0,
      baseLegal: 'Lei 8036/1990',
      regimesAplicaveis: [
        RegimeTributario.SIMPLES,
        RegimeTributario.PRESUMIDO,
        RegimeTributario.REAL,
      ],
      requerFolha: true,
    },
    {
      codigo: 'DARF-IRRF',
      nome: 'DARF IRRF',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_UTIL_N,
      dia: 20,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.ANTECIPAR,
      criticidade: Criticidade.ALTA,
      multaBase: 50,
      multaPercentual: 0.33,
      baseLegal: 'RIR/2018',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL, RegimeTributario.SIMPLES],
      requerFolha: true,
    },
    {
      codigo: 'IRPJ-CSLL',
      nome: 'IRPJ/CSLL Trimestral',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.TRIMESTRAL,
      regraVencimento: RegraVencimento.DIA_UTIL_N,
      dia: lastDiaUtilTrimestrePlaceholder(),
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.CRITICA,
      multaBase: 500,
      multaPercentual: 0.33,
      baseLegal: 'Lei 9430/1996',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL],
    },
    {
      codigo: 'ECD',
      nome: 'ECD - Escrituração Contábil Digital',
      area: Area.CONTABIL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.ANUAL,
      regraVencimento: RegraVencimento.ULTIMO_DIA_UTIL,
      dia: null,
      mesesDefasagem: 5, // maio do ano seguinte
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.MANTER,
      criticidade: Criticidade.ALTA,
      multaBase: 5000,
      multaPercentual: 0,
      baseLegal: 'IN RFB 2003/2021',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL],
    },
    {
      codigo: 'ECF',
      nome: 'ECF - Escrituração Contábil Fiscal',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.ANUAL,
      regraVencimento: RegraVencimento.ULTIMO_DIA_UTIL,
      dia: null,
      mesesDefasagem: 7, // julho do ano seguinte
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.MANTER,
      criticidade: Criticidade.ALTA,
      multaBase: 5000,
      multaPercentual: 0,
      baseLegal: 'IN RFB 2004/2021',
      regimesAplicaveis: [RegimeTributario.PRESUMIDO, RegimeTributario.REAL],
    },
    {
      codigo: 'DEFIS',
      nome: 'DEFIS - Declaração de Informações Socioeconômicas e Fiscais',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.ANUAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 31,
      mesesDefasagem: 3,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.MEDIA,
      multaBase: 50,
      multaPercentual: 0,
      baseLegal: 'LC 123/2006',
      regimesAplicaveis: [RegimeTributario.SIMPLES],
    },
    {
      codigo: 'DIRF',
      nome: 'DIRF',
      area: Area.FISCAL,
      esfera: Esfera.FEDERAL,
      periodicidade: Periodicidade.ANUAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 28,
      mesesDefasagem: 2,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.ANTECIPAR,
      criticidade: Criticidade.MEDIA,
      multaBase: 500,
      multaPercentual: 0,
      baseLegal: 'IN RFB 1756/2017',
      regimesAplicaveis: [
        RegimeTributario.SIMPLES,
        RegimeTributario.PRESUMIDO,
        RegimeTributario.REAL,
      ],
      requerFolha: true,
    },
    {
      codigo: 'FOLHA',
      nome: 'Fechamento de Folha',
      area: Area.DP,
      esfera: Esfera.INTERNA,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 5,
      mesesDefasagem: 1,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.ANTECIPAR,
      criticidade: Criticidade.ALTA,
      multaBase: 0,
      multaPercentual: 0,
      baseLegal: 'Rotina interna',
      regimesAplicaveis: [
        RegimeTributario.MEI,
        RegimeTributario.SIMPLES,
        RegimeTributario.PRESUMIDO,
        RegimeTributario.REAL,
      ],
      requerFolha: true,
    },
    {
      codigo: 'FERIAS',
      nome: 'Controle de Férias',
      area: Area.DP,
      esfera: Esfera.INTERNA,
      periodicidade: Periodicidade.MENSAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 10,
      mesesDefasagem: 0,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.POSTERGAR,
      criticidade: Criticidade.MEDIA,
      multaBase: 0,
      multaPercentual: 0,
      baseLegal: 'Rotina interna CLT',
      regimesAplicaveis: [
        RegimeTributario.SIMPLES,
        RegimeTributario.PRESUMIDO,
        RegimeTributario.REAL,
      ],
      requerFolha: true,
    },
    {
      codigo: 'RESCISAO',
      nome: 'Checklist de Rescisão',
      area: Area.DP,
      esfera: Esfera.INTERNA,
      periodicidade: Periodicidade.EVENTUAL,
      regraVencimento: RegraVencimento.DIA_FIXO,
      dia: 10,
      mesesDefasagem: 0,
      ajusteDiaNaoUtil: AjusteDiaNaoUtil.ANTECIPAR,
      criticidade: Criticidade.ALTA,
      multaBase: 0,
      multaPercentual: 0,
      baseLegal: 'Art. 477 CLT',
      regimesAplicaveis: [
        RegimeTributario.SIMPLES,
        RegimeTributario.PRESUMIDO,
        RegimeTributario.REAL,
      ],
      requerFolha: true,
    },
  ];

  const mapa: Record<string, string> = {};
  for (const item of itens) {
    const created = await prisma.obrigacao.create({ data: item });
    mapa[created.codigo] = created.id;
  }
  return mapa;
}

function lastDiaUtilTrimestrePlaceholder() {
  return 15;
}

async function seedColaboradores() {
  const gestor = await prisma.colaborador.create({
    data: {
      nome: 'Ana Gestora',
      email: 'ana@escritorio.com',
      cargo: 'Sócia Gestora',
      area: Area.FISCAL,
      capacidadeMensal: 120,
      papel: Papel.GESTOR,
      senhaHash: SENHA_DEMO,
    },
  });

  const fiscal = await prisma.colaborador.create({
    data: {
      nome: 'Bruno Fiscal',
      email: 'bruno@escritorio.com',
      cargo: 'Analista Fiscal',
      area: Area.FISCAL,
      capacidadeMensal: 160,
      papel: Papel.COLABORADOR,
      senhaHash: SENHA_DEMO,
    },
  });

  const contabil = await prisma.colaborador.create({
    data: {
      nome: 'Carla Contábil',
      email: 'carla@escritorio.com',
      cargo: 'Analista Contábil',
      area: Area.CONTABIL,
      capacidadeMensal: 160,
      papel: Papel.COLABORADOR,
      senhaHash: SENHA_DEMO,
    },
  });

  const dp = await prisma.colaborador.create({
    data: {
      nome: 'Diego DP',
      email: 'diego@escritorio.com',
      cargo: 'Analista de DP',
      area: Area.DP,
      capacidadeMensal: 140,
      papel: Papel.COLABORADOR,
      senhaHash: SENHA_DEMO,
    },
  });

  return { gestor, fiscal, contabil, dp };
}

async function seedClientes(cols: Awaited<ReturnType<typeof seedColaboradores>>) {
  const dados = [
    {
      razaoSocial: 'Padaria Pão Quente ME',
      cnpj: '12.345.678/0001-90',
      regimeTributario: RegimeTributario.MEI,
      temFolha: false,
      uf: 'SP',
      municipio: 'São Paulo',
      responsavelPadraoId: cols.fiscal.id,
    },
    {
      razaoSocial: 'Tech Solutions LTDA',
      cnpj: '23.456.789/0001-01',
      regimeTributario: RegimeTributario.SIMPLES,
      temFolha: true,
      uf: 'SP',
      municipio: 'Campinas',
      responsavelPadraoId: cols.fiscal.id,
    },
    {
      razaoSocial: 'Comércio Verde SA',
      cnpj: '34.567.890/0001-12',
      regimeTributario: RegimeTributario.SIMPLES,
      temFolha: true,
      uf: 'RJ',
      municipio: 'Rio de Janeiro',
      responsavelPadraoId: cols.fiscal.id,
    },
    {
      razaoSocial: 'Indústria Metalúrgica Norte LTDA',
      cnpj: '45.678.901/0001-23',
      regimeTributario: RegimeTributario.PRESUMIDO,
      temFolha: true,
      uf: 'MG',
      municipio: 'Belo Horizonte',
      responsavelPadraoId: cols.contabil.id,
    },
    {
      razaoSocial: 'Consultoria Alpha LTDA',
      cnpj: '56.789.012/0001-34',
      regimeTributario: RegimeTributario.PRESUMIDO,
      temFolha: true,
      uf: 'SP',
      municipio: 'São Paulo',
      responsavelPadraoId: cols.contabil.id,
    },
    {
      razaoSocial: 'Holding Beta SA',
      cnpj: '67.890.123/0001-45',
      regimeTributario: RegimeTributario.REAL,
      temFolha: true,
      uf: 'SP',
      municipio: 'São Paulo',
      responsavelPadraoId: cols.contabil.id,
    },
    {
      razaoSocial: 'Logística Express LTDA',
      cnpj: '78.901.234/0001-56',
      regimeTributario: RegimeTributario.REAL,
      temFolha: true,
      uf: 'PR',
      municipio: 'Curitiba',
      responsavelPadraoId: cols.dp.id,
    },
    {
      razaoSocial: 'Café & Cia ME',
      cnpj: '89.012.345/0001-67',
      regimeTributario: RegimeTributario.SIMPLES,
      temFolha: false,
      uf: 'BA',
      municipio: 'Salvador',
      responsavelPadraoId: cols.fiscal.id,
    },
  ];

  const clientes = [];
  for (const d of dados) {
    clientes.push(await prisma.cliente.create({ data: d }));
  }
  return clientes;
}

async function vincularObrigacoes(
  clientes: Awaited<ReturnType<typeof seedClientes>>,
  obrMap: Record<string, string>,
  cols: Awaited<ReturnType<typeof seedColaboradores>>,
) {
  const vigenciaInicio = new Date(2025, 0, 1);
  const vinculos = [];

  for (const cliente of clientes) {
    const obrigacoes = await prisma.obrigacao.findMany({
      where: {
        ativo: true,
        regimesAplicaveis: { has: cliente.regimeTributario },
        OR: [{ requerFolha: false }, { requerFolha: cliente.temFolha }],
        // EVENTUAL não gera automaticamente no seed mensal
        NOT: { periodicidade: Periodicidade.EVENTUAL },
      },
    });

    for (const obr of obrigacoes) {
      let responsavelId = cliente.responsavelPadraoId;
      if (obr.area === Area.DP) responsavelId = cols.dp.id;
      if (obr.area === Area.CONTABIL) responsavelId = cols.contabil.id;
      if (obr.area === Area.FISCAL) responsavelId = cols.fiscal.id;

      const v = await prisma.clienteObrigacao.create({
        data: {
          clienteId: cliente.id,
          obrigacaoId: obr.id,
          responsavelId,
          vigenciaInicio,
          ativo: true,
        },
      });
      vinculos.push({ ...v, obrigacao: obr, cliente });
    }
  }

  return vinculos;
}

async function seedTarefasHistorico(
  vinculos: Awaited<ReturnType<typeof vincularObrigacoes>>,
  cols: Awaited<ReturnType<typeof seedColaboradores>>,
) {
  const feriadosDb = await prisma.feriado.findMany();
  const feriados: FeriadoInfo[] = feriadosDb.map((f) => ({
    data: f.data,
    abrangencia: f.abrangencia,
    uf: f.uf,
    municipio: f.municipio,
  }));

  const hoje = new Date();
  // 3 competências passadas + atual + próximas 2
  const competencias: string[] = [];
  for (let i = -3; i <= 2; i++) {
    const d = subMonths(hoje, -i);
    competencias.push(formatCompetencia(d.getFullYear(), d.getMonth() + 1));
  }

  let contador = 0;

  for (const vinculo of vinculos) {
    // Só gera mensais no histórico demo (anuais/trimestrais ficam mais esparsos)
    if (vinculo.obrigacao.periodicidade !== Periodicidade.MENSAL) {
      // gera só a competência atual para anuais/trimestrais
      const compAtual = competencias[3];
      await criarTarefaDemo(vinculo, compAtual, feriados, cols, 'futura', contador++);
      continue;
    }

    for (let i = 0; i < competencias.length; i++) {
      const tipo =
        i < 3 ? 'historico' : i === 3 ? 'atual' : 'futura';
      await criarTarefaDemo(vinculo, competencias[i], feriados, cols, tipo, contador++);
    }
  }
}

async function criarTarefaDemo(
  vinculo: Awaited<ReturnType<typeof vincularObrigacoes>>[number],
  competencia: string,
  feriados: FeriadoInfo[],
  cols: Awaited<ReturnType<typeof seedColaboradores>>,
  tipo: 'historico' | 'atual' | 'futura',
  seed: number,
) {
  const dataVencimento = calcularVencimento(
    {
      regraVencimento: vinculo.obrigacao.regraVencimento,
      dia: vinculo.obrigacao.dia,
      mesesDefasagem: vinculo.obrigacao.mesesDefasagem,
      ajusteDiaNaoUtil: vinculo.obrigacao.ajusteDiaNaoUtil,
    },
    competencia,
    feriados,
    vinculo.cliente.uf,
    vinculo.cliente.municipio,
  );

  let status: StatusTarefa = StatusTarefa.PENDENTE;
  let dataConclusao: Date | null = null;
  const modulo = seed % 7;

  if (tipo === 'historico') {
    if (modulo === 0) {
      status = StatusTarefa.CONCLUIDA;
      dataConclusao = addDays(dataVencimento, 2); // atrasada
    } else if (modulo === 1) {
      status = StatusTarefa.PENDENTE; // ainda aberta = atraso
    } else {
      status = StatusTarefa.CONCLUIDA;
      dataConclusao = subDays(dataVencimento, 1);
    }
  } else if (tipo === 'atual') {
    if (modulo === 0) status = StatusTarefa.EM_ANDAMENTO;
    else if (modulo === 1) status = StatusTarefa.AGUARDANDO_CLIENTE;
    else if (modulo === 2) {
      status = StatusTarefa.CONCLUIDA;
      dataConclusao = subDays(new Date(), 1);
    } else {
      status = StatusTarefa.PENDENTE;
    }
  }

  const tarefa = await prisma.tarefa.create({
    data: {
      clienteObrigacaoId: vinculo.id,
      competencia,
      dataVencimento,
      status,
      prioridade:
        vinculo.obrigacao.criticidade === Criticidade.CRITICA
          ? 'URGENTE'
          : vinculo.obrigacao.criticidade === Criticidade.ALTA
            ? 'ALTA'
            : 'MEDIA',
      responsavelId: vinculo.responsavelId,
      dataConclusao,
      esforcoEstimado: 2 + (seed % 4),
      protocolo: status === StatusTarefa.CONCLUIDA ? `PROT-${seed}` : null,
    },
  });

  await prisma.tarefaEvento.create({
    data: {
      tarefaId: tarefa.id,
      statusNovo: StatusTarefa.PENDENTE,
      responsavelNovoId: vinculo.responsavelId,
      autorId: cols.gestor.id,
      observacao: 'Criada no seed',
      criadoEm: subDays(dataVencimento, 20),
    },
  });

  if (status === StatusTarefa.EM_ANDAMENTO || status === StatusTarefa.AGUARDANDO_CLIENTE || status === StatusTarefa.CONCLUIDA) {
    await prisma.tarefaEvento.create({
      data: {
        tarefaId: tarefa.id,
        statusAnterior: StatusTarefa.PENDENTE,
        statusNovo: StatusTarefa.EM_ANDAMENTO,
        autorId: vinculo.responsavelId,
        criadoEm: subDays(dataVencimento, 10),
      },
    });
  }

  if (status === StatusTarefa.AGUARDANDO_CLIENTE) {
    await prisma.tarefaEvento.create({
      data: {
        tarefaId: tarefa.id,
        statusAnterior: StatusTarefa.EM_ANDAMENTO,
        statusNovo: StatusTarefa.AGUARDANDO_CLIENTE,
        autorId: vinculo.responsavelId,
        criadoEm: subDays(dataVencimento, 5),
      },
    });
  }

  if (status === StatusTarefa.CONCLUIDA && dataConclusao) {
    await prisma.tarefaEvento.create({
      data: {
        tarefaId: tarefa.id,
        statusAnterior: StatusTarefa.EM_ANDAMENTO,
        statusNovo: StatusTarefa.CONCLUIDA,
        autorId: vinculo.responsavelId,
        criadoEm: dataConclusao,
      },
    });
  }
}

async function main() {
  SENHA_DEMO = await bcrypt.hash('senha123', 10);
  console.log('Limpando base...');
  await limpar();

  console.log('Feriados...');
  await seedFeriados();

  console.log('Catálogo de obrigações...');
  const obrMap = await seedObrigacoes();

  console.log('Colaboradores...');
  const cols = await seedColaboradores();

  console.log('Clientes...');
  const clientes = await seedClientes(cols);

  console.log('Vínculos cliente-obrigação...');
  const vinculos = await vincularObrigacoes(clientes, obrMap, cols);

  console.log('Tarefas histórico + futuras...');
  await seedTarefasHistorico(vinculos, cols);

  const totais = {
    feriados: await prisma.feriado.count(),
    obrigacoes: await prisma.obrigacao.count(),
    colaboradores: await prisma.colaborador.count(),
    clientes: await prisma.cliente.count(),
    vinculos: await prisma.clienteObrigacao.count(),
    tarefas: await prisma.tarefa.count(),
    eventos: await prisma.tarefaEvento.count(),
  };

  console.log('Seed concluído:', totais);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

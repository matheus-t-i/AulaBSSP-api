import type { PrismaClient } from '@prisma/client';
import {
  calcularVencimento,
  formatCompetencia,
  listarCompetenciasFuturas,
  parseCompetencia,
  type FeriadoInfo,
} from './vencimento.js';

export type GeracaoResultado = {
  criadas: number;
  existentes: number;
  competencias: string[];
};

export async function gerarTarefasCompetencias(
  prisma: PrismaClient,
  horizonteMeses = 3,
  referencia?: Date,
): Promise<GeracaoResultado> {
  const competencias = listarCompetenciasFuturas(horizonteMeses, referencia);
  const feriadosDb = await prisma.feriado.findMany();
  const feriados: FeriadoInfo[] = feriadosDb.map((f) => ({
    data: f.data,
    abrangencia: f.abrangencia,
    uf: f.uf,
    municipio: f.municipio,
  }));

  const vinculos = await prisma.clienteObrigacao.findMany({
    where: { ativo: true },
    include: {
      cliente: true,
      obrigacao: true,
    },
  });

  let criadas = 0;
  let existentes = 0;

  for (const vinculo of vinculos) {
    for (const compStr of competencias) {
      const comp = parseCompetencia(compStr);
      const inicioComp = new Date(comp.ano, comp.mes - 1, 1);

      if (vinculo.vigenciaInicio > inicioComp) continue;
      if (vinculo.vigenciaFim && vinculo.vigenciaFim < inicioComp) continue;

      const jaExiste = await prisma.tarefa.findUnique({
        where: {
          clienteObrigacaoId_competencia: {
            clienteObrigacaoId: vinculo.id,
            competencia: compStr,
          },
        },
      });

      if (jaExiste) {
        existentes += 1;
        continue;
      }

      const obrigacaoParaCalculo = {
        regraVencimento: vinculo.obrigacao.regraVencimento,
        dia: vinculo.diaCustomizado ?? vinculo.obrigacao.dia,
        mesesDefasagem: vinculo.obrigacao.mesesDefasagem,
        ajusteDiaNaoUtil: vinculo.obrigacao.ajusteDiaNaoUtil,
      };

      const dataVencimento = calcularVencimento(
        obrigacaoParaCalculo,
        comp,
        feriados,
        vinculo.cliente.uf,
        vinculo.cliente.municipio,
      );

      const responsavelId =
        vinculo.responsavelId ?? vinculo.cliente.responsavelPadraoId ?? null;

      const prioridade =
        vinculo.obrigacao.criticidade === 'CRITICA'
          ? 'URGENTE'
          : vinculo.obrigacao.criticidade === 'ALTA'
            ? 'ALTA'
            : vinculo.obrigacao.criticidade === 'BAIXA'
              ? 'BAIXA'
              : 'MEDIA';

      await prisma.tarefa.create({
        data: {
          clienteObrigacaoId: vinculo.id,
          competencia: compStr,
          dataVencimento,
          responsavelId,
          prioridade,
          esforcoEstimado: 2,
          eventos: {
            create: {
              statusNovo: 'PENDENTE',
              responsavelNovoId: responsavelId,
              observacao: 'Tarefa gerada automaticamente',
            },
          },
        },
      });

      criadas += 1;
    }
  }

  return { criadas, existentes, competencias };
}

export { formatCompetencia };

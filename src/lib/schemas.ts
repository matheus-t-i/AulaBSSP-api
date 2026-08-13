import { z } from 'zod';
import { formatCnpj, isCnpjValido, onlyCnpjChars } from './cnpj.js';

export const regimeSchema = z.enum(['MEI', 'SIMPLES', 'PRESUMIDO', 'REAL']);
export const areaSchema = z.enum(['FISCAL', 'CONTABIL', 'DP', 'SOCIETARIO']);
export const papelSchema = z.enum(['GESTOR', 'COLABORADOR']);
export const statusTarefaSchema = z.enum([
  'PENDENTE',
  'EM_ANDAMENTO',
  'AGUARDANDO_CLIENTE',
  'CONCLUIDA',
  'DISPENSADA',
]);

const cnpjSchema = z
  .string()
  .min(1, 'Informe o CNPJ')
  .transform((v) => formatCnpj(v))
  .refine((v) => onlyCnpjChars(v).length === 14, {
    message: 'CNPJ deve ter 14 caracteres (máscara XX.XXX.XXX/XXXX-DV)',
  })
  .refine((v) => isCnpjValido(v), {
    message: 'CNPJ inválido (dígito verificador ou formato)',
  });

export const createColaboradorSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cargo: z.string().min(2),
  area: areaSchema,
  capacidadeMensal: z.number().int().positive().optional(),
  papel: papelSchema.optional(),
  senha: z.string().min(6).optional(),
  ativo: z.boolean().optional(),
});

export const updateColaboradorSchema = createColaboradorSchema.partial();

export const createClienteSchema = z.object({
  razaoSocial: z.string().min(2),
  cnpj: cnpjSchema,
  regimeTributario: regimeSchema,
  temFolha: z.boolean().optional(),
  uf: z.string().length(2),
  municipio: z.string().min(2),
  responsavelPadraoId: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  vincularPacoteRegime: z.boolean().optional(),
});

export const updateClienteSchema = createClienteSchema.partial();

export const createObrigacaoSchema = z.object({
  codigo: z.string().min(2),
  nome: z.string().min(2),
  area: areaSchema,
  esfera: z.enum(['FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'INTERNA']),
  periodicidade: z.enum(['MENSAL', 'TRIMESTRAL', 'ANUAL', 'EVENTUAL']),
  regraVencimento: z.enum(['DIA_FIXO', 'DIA_UTIL_N', 'ULTIMO_DIA_UTIL', 'ULTIMO_DIA_MES']),
  dia: z.number().int().min(1).max(31).optional().nullable(),
  mesesDefasagem: z.number().int().min(0).max(24).optional(),
  ajusteDiaNaoUtil: z.enum(['ANTECIPAR', 'POSTERGAR', 'MANTER']).optional(),
  criticidade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  multaBase: z.number().min(0).optional(),
  multaPercentual: z.number().min(0).optional(),
  baseLegal: z.string().optional().nullable(),
  regimesAplicaveis: z.array(regimeSchema).min(1),
  requerFolha: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export const updateObrigacaoSchema = createObrigacaoSchema.partial();

export const vincularObrigacaoSchema = z.object({
  obrigacaoId: z.string().min(1),
  responsavelId: z.string().optional().nullable(),
  diaCustomizado: z.number().int().min(1).max(31).optional().nullable(),
  vigenciaInicio: z.string().optional(),
  vigenciaFim: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export const updateStatusSchema = z
  .object({
    status: statusTarefaSchema,
    protocolo: z.string().optional().nullable(),
    observacao: z.string().optional().nullable(),
    evidenciaDescricao: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'CONCLUIDA') {
      const desc = data.evidenciaDescricao?.trim();
      if (!desc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a descrição da evidência para concluir a tarefa',
          path: ['evidenciaDescricao'],
        });
      }
    }
  });

export const updateResponsavelSchema = z.object({
  responsavelId: z.string().nullable(),
  observacao: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export const alterarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    senhaNova: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.senhaNova === d.confirmarSenha, {
    message: 'A confirmação não confere com a nova senha',
    path: ['confirmarSenha'],
  });

export const solicitarReativacaoSchema = z.object({
  email: z.string().email(),
  senhaNova: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres'),
});

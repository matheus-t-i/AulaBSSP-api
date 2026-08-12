-- CreateEnum
CREATE TYPE "RegimeTributario" AS ENUM ('MEI', 'SIMPLES', 'PRESUMIDO', 'REAL');

-- CreateEnum
CREATE TYPE "Area" AS ENUM ('FISCAL', 'CONTABIL', 'DP', 'SOCIETARIO');

-- CreateEnum
CREATE TYPE "Esfera" AS ENUM ('FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'INTERNA');

-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('MENSAL', 'TRIMESTRAL', 'ANUAL', 'EVENTUAL');

-- CreateEnum
CREATE TYPE "RegraVencimento" AS ENUM ('DIA_FIXO', 'DIA_UTIL_N', 'ULTIMO_DIA_UTIL', 'ULTIMO_DIA_MES');

-- CreateEnum
CREATE TYPE "AjusteDiaNaoUtil" AS ENUM ('ANTECIPAR', 'POSTERGAR', 'MANTER');

-- CreateEnum
CREATE TYPE "Criticidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'CONCLUIDA', 'DISPENSADA');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('GESTOR', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "AbrangenciaFeriado" AS ENUM ('NACIONAL', 'UF', 'MUNICIPIO');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "regimeTributario" "RegimeTributario" NOT NULL,
    "temFolha" BOOLEAN NOT NULL DEFAULT false,
    "uf" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "responsavelPadraoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "cargo" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "capacidadeMensal" INTEGER NOT NULL DEFAULT 160,
    "papel" "Papel" NOT NULL DEFAULT 'COLABORADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obrigacao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "esfera" "Esfera" NOT NULL,
    "periodicidade" "Periodicidade" NOT NULL,
    "regraVencimento" "RegraVencimento" NOT NULL,
    "dia" INTEGER,
    "mesesDefasagem" INTEGER NOT NULL DEFAULT 1,
    "ajusteDiaNaoUtil" "AjusteDiaNaoUtil" NOT NULL DEFAULT 'POSTERGAR',
    "criticidade" "Criticidade" NOT NULL DEFAULT 'MEDIA',
    "multaBase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "multaPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "baseLegal" TEXT,
    "regimesAplicaveis" "RegimeTributario"[],
    "requerFolha" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteObrigacao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "obrigacaoId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "diaCustomizado" INTEGER,
    "vigenciaInicio" DATE NOT NULL,
    "vigenciaFim" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteObrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "clienteObrigacaoId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "status" "StatusTarefa" NOT NULL DEFAULT 'PENDENTE',
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "responsavelId" TEXT,
    "dataConclusao" TIMESTAMP(3),
    "protocolo" TEXT,
    "observacao" TEXT,
    "esforcoEstimado" INTEGER NOT NULL DEFAULT 2,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarefaEvento" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "statusAnterior" "StatusTarefa",
    "statusNovo" "StatusTarefa",
    "responsavelAnteriorId" TEXT,
    "responsavelNovoId" TEXT,
    "autorId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarefaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feriado" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,
    "abrangencia" "AbrangenciaFeriado" NOT NULL DEFAULT 'NACIONAL',
    "uf" TEXT,
    "municipio" TEXT,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cnpj_key" ON "Cliente"("cnpj");

-- CreateIndex
CREATE INDEX "Cliente_regimeTributario_idx" ON "Cliente"("regimeTributario");

-- CreateIndex
CREATE INDEX "Cliente_ativo_idx" ON "Cliente"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_email_key" ON "Colaborador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Obrigacao_codigo_key" ON "Obrigacao"("codigo");

-- CreateIndex
CREATE INDEX "ClienteObrigacao_ativo_idx" ON "ClienteObrigacao"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteObrigacao_clienteId_obrigacaoId_key" ON "ClienteObrigacao"("clienteId", "obrigacaoId");

-- CreateIndex
CREATE INDEX "Tarefa_dataVencimento_idx" ON "Tarefa"("dataVencimento");

-- CreateIndex
CREATE INDEX "Tarefa_status_idx" ON "Tarefa"("status");

-- CreateIndex
CREATE INDEX "Tarefa_responsavelId_idx" ON "Tarefa"("responsavelId");

-- CreateIndex
CREATE INDEX "Tarefa_competencia_idx" ON "Tarefa"("competencia");

-- CreateIndex
CREATE UNIQUE INDEX "Tarefa_clienteObrigacaoId_competencia_key" ON "Tarefa"("clienteObrigacaoId", "competencia");

-- CreateIndex
CREATE INDEX "TarefaEvento_tarefaId_idx" ON "TarefaEvento"("tarefaId");

-- CreateIndex
CREATE INDEX "TarefaEvento_criadoEm_idx" ON "TarefaEvento"("criadoEm");

-- CreateIndex
CREATE INDEX "Feriado_data_idx" ON "Feriado"("data");

-- CreateIndex
CREATE INDEX "Feriado_abrangencia_uf_municipio_idx" ON "Feriado"("abrangencia", "uf", "municipio");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_responsavelPadraoId_fkey" FOREIGN KEY ("responsavelPadraoId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteObrigacao" ADD CONSTRAINT "ClienteObrigacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteObrigacao" ADD CONSTRAINT "ClienteObrigacao_obrigacaoId_fkey" FOREIGN KEY ("obrigacaoId") REFERENCES "Obrigacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteObrigacao" ADD CONSTRAINT "ClienteObrigacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_clienteObrigacaoId_fkey" FOREIGN KEY ("clienteObrigacaoId") REFERENCES "ClienteObrigacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaEvento" ADD CONSTRAINT "TarefaEvento_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaEvento" ADD CONSTRAINT "TarefaEvento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

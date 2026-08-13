-- CreateEnum
CREATE TYPE "StatusReativacao" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "ReativacaoPedido" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "senhaHashNova" TEXT,
    "status" "StatusReativacao" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoEm" TIMESTAMP(3),
    "decididoPorId" TEXT,

    CONSTRAINT "ReativacaoPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReativacaoPedido_status_idx" ON "ReativacaoPedido"("status");

-- CreateIndex
CREATE INDEX "ReativacaoPedido_colaboradorId_idx" ON "ReativacaoPedido"("colaboradorId");

-- AddForeignKey
ALTER TABLE "ReativacaoPedido" ADD CONSTRAINT "ReativacaoPedido_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReativacaoPedido" ADD CONSTRAINT "ReativacaoPedido_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

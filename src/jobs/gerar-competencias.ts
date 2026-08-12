import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { gerarTarefasCompetencias } from '../domain/geracao.js';

async function main() {
  const horizonte = Number(process.argv[2] ?? 3);
  console.log(`Gerando tarefas (horizonte ${horizonte} meses)...`);
  const result = await gerarTarefasCompetencias(prisma, horizonte);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

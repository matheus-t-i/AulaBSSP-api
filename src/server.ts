import 'dotenv/config';
import cron from 'node-cron';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { gerarTarefasCompetencias } from './domain/geracao.js';

const PORT = Number(process.env.PORT || 3001);
const app = createApp();

// Job diário às 06:00 (America/Sao_Paulo via TZ do ambiente)
cron.schedule('0 6 * * *', async () => {
  try {
    console.log('[job] Gerando tarefas das próximas competências...');
    const result = await gerarTarefasCompetencias(prisma, 3);
    console.log('[job] Concluído:', result);
  } catch (err) {
    console.error('[job] Erro na geração:', err);
  }
});

app.listen(PORT, () => {
  console.log(`API Agenda Fiscal rodando em http://localhost:${PORT}`);
});

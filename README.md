# Agenda Fiscal Contábil — API

API do painel de gestão que cruza agenda fiscal, tarefas por colaborador, atrasos com risco de multa e rendimento da equipe.

## Stack

- **API:** Node.js + TypeScript + Express + Prisma
- **Banco:** PostgreSQL 16 (Docker) + Adminer

## Como subir

```bash
# 1. Banco
docker compose up -d

# 2. API
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

- API: http://localhost:3001
- Adminer: http://localhost:8080 (servidor `postgres`, usuário `agenda`, senha `agenda123`, base `agenda_fiscal`)

> Postgres está mapeado na porta **5433** do host (5432 já estava em uso neste ambiente).

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Sobe a API com hot reload |
| `npm run seed` | Popula catálogo e dados demo |
| `npm run gerar` | Gera tarefas das próximas competências |
| `npm test` | Testes do motor de vencimento |

## Login demo

| Usuário | E-mail | Senha | Papel |
|---------|--------|-------|-------|
| Ana Gestora | ana@escritorio.com | senha123 | GESTOR |
| Bruno Fiscal | bruno@escritorio.com | senha123 | COLABORADOR |
| Carla Contábil | carla@escritorio.com | senha123 | COLABORADOR |
| Diego DP | diego@escritorio.com | senha123 | COLABORADOR |

O painel web fica em repositório separado.

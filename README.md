# MailFlow ✉️

Plataforma **SaaS multi-tenant de e-mail marketing** em TypeScript: contatos e listas, segmentação por regras, campanhas com teste A/B, automações, rastreamento de aberturas e cliques, domínios de envio próprios e assistente de IA no editor.

> **EN:** Full-stack TypeScript multi-tenant email marketing SaaS (React 19 + tRPC + Express + Drizzle/MySQL): contacts, rule-based segments, A/B-tested campaigns, automations, open/click tracking, custom sending domains and an AI writing assistant.

## Funcionalidades

- **Multi-tenant:** organizações, membros e papéis (convite, remoção, troca de papel)
- **Contatos:** CRUD, importação/exportação CSV, tags, campos personalizados e perfil com linha do tempo de engajamento
- **Segmentos dinâmicos** com construtor de regras
- **Campanhas:** criação, agendamento, envio em massa e **teste A/B** (divisão 50/50 e vencedora por métrica)
- **Editor de e-mail:** HTML rico, texto simples e construtor visual *drag-and-drop* (título, texto, imagem, botão, divisor)
- **Assistente de IA:** sugestões de linha de assunto e otimização do texto
- **Automações** com gatilhos e etapas
- **Entregabilidade:** domínios de envio com verificação de DNS e configurações SMTP
- **Métricas:** pixel de abertura, redirecionamento de cliques, bounces e descadastros, dashboard consolidado

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query, React Hook Form + Zod, Recharts |
| API | Express + **tRPC** (tipagem ponta a ponta) |
| Banco de dados | MySQL com **Drizzle ORM** (schema e migrations em `drizzle/`) |
| Arquivos | AWS S3 (URLs pré-assinadas) |
| Testes | **Vitest** (procedures principais, IA e A/B) |
| Ferramentas | TypeScript, pnpm, esbuild, Prettier |

## Estrutura

```
mailflow/
├── client/     # aplicação React
├── server/     # Express + routers tRPC, envio e rastreamento
├── shared/     # tipos e validações usados pelos dois lados
├── drizzle/    # schema e migrations
└── todo.md     # roadmap por rodadas (tudo que já foi entregue)
```

## Como executar

```bash
pnpm install
# crie um .env com DATABASE_URL (MySQL) e as credenciais de envio
pnpm db:push     # gera e aplica as migrations
pnpm dev         # servidor de desenvolvimento
pnpm test        # testes com Vitest
pnpm build && pnpm start   # build de produção
```

## Processo de desenvolvimento

Construído em rodadas incrementais com apoio de um agente de IA (Manus): eu defini os requisitos e o escopo de cada rodada, revisei o código e validei os fluxos. O histórico de *checkpoints* está nos commits e o roadmap em `todo.md`.

## Autora

**Jessica Baptista** · [GitHub](https://github.com/JessicaGPW) · [LinkedIn](https://www.linkedin.com/in/baptistajessica/)

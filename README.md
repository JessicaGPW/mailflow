# MailFlow ✉️

Plataforma **SaaS multi-tenant de e-mail marketing** em TypeScript: contatos e listas, segmentação por regras, campanhas com teste A/B, automações, rastreamento de aberturas e cliques, domínios de envio próprios e assistente de IA no editor.

> **EN:** End-to-end TypeScript multi-tenant email marketing SaaS (React 19 + tRPC + Express + Drizzle/MySQL): contacts, rule-based segments, A/B-tested campaigns, automations, open/click tracking, custom sending domains and an AI writing assistant.

## Funcionalidades

- **Multi-tenant:** organizações, membros e papéis (convite, remoção, troca de papel)
- **Contatos:** CRUD, importação/exportação CSV, tags, campos personalizados e perfil com linha do tempo de engajamento
- **Segmentos dinâmicos** com construtor de regras
- **Campanhas:** criação, agendamento, envio em massa e **teste A/B** (divisão 50/50 e vencedora por métrica)
- **Editor de e-mail:** HTML rico, texto simples e construtor visual *drag-and-drop* (título, texto, imagem, botão, divisor)
- **Assistente de IA:** sugestões de linha de assunto e otimização do texto
- **Automações** com gatilhos e etapas
- **Entregabilidade:** domínios de envio com verificação de DNS e provedores de envio (SendGrid e Mailgun; SES e SMTP próprio ainda não suportados)
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

## Segurança

- **Links de rastreamento assinados:** abertura, clique e descadastro levam um token HMAC ligado a (campanha, contato, finalidade). IDs sequenciais sozinhos não descadastram ninguém nem inflam métricas, e o descadastro só altera contatos da organização dona da campanha.
- **Credenciais criptografadas:** chave de API e senha SMTP ficam no banco com AES-256-GCM e nunca voltam para o front (aparecem mascaradas).
- **Envio sem duplicidade:** a campanha passa para `sending` de forma atômica; clique duplo ou repetição do agendador não reenviam.
- **Papéis:** enviar ou excluir campanhas e gerenciar credenciais de envio exige papel de administrador da organização.
- **Teste A/B justo:** a amostra e as variantes são sorteadas (Fisher–Yates), não os primeiros contatos da lista.

## Como executar

```bash
pnpm install
# .env: DATABASE_URL (MySQL), JWT_SECRET e TRACKING_SECRET (obrigatório em produção)
pnpm db:push     # gera e aplica as migrations
pnpm dev         # servidor de desenvolvimento
pnpm test        # testes com Vitest
pnpm build && pnpm start   # build de produção
```

> Login, IA e agendamento usam os serviços da plataforma Manus (OAuth, LLM e Heartbeat), configurados por variáveis de ambiente. Fora dela, essas partes precisam de substitutos.

### Testes

```bash
pnpm test                                         # unitários (sem banco nem rede)
DATABASE_URL=mysql://user:pass@localhost:3306/mailflow pnpm test   # + integração com MySQL
RUN_NETWORK_TESTS=1 pnpm test                     # + verificação de DNS ao vivo
```

Sem `DATABASE_URL`, as suítes de integração são puladas em vez de falhar.

## Processo de desenvolvimento

Construído em rodadas incrementais com apoio de um agente de IA (Manus): eu defini os requisitos e o escopo de cada rodada, revisei o código e validei os fluxos. O histórico de *checkpoints* está nos commits e o roadmap em `todo.md`.

Depois, uma revisão de segurança do código gerado encontrou e corrigiu: descadastro e métricas forjáveis por IDs sequenciais, cliques atribuídos à campanha errada, provedores não suportados que marcavam e-mails como "entregues", reenvio duplo de campanhas, amostra A/B enviesada, credenciais em texto puro e ações sem checagem de papel. Cada correção tem testes (`server/security.test.ts` e `server/hardening.test.ts`).

## Autora

**Jessica Baptista** · [GitHub](https://github.com/JessicaGPW) · [LinkedIn](https://www.linkedin.com/in/baptistajessica/)

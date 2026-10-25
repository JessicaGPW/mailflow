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
| Arquivos | Sem armazenamento remoto obrigatório |
| Testes | **Vitest** (procedures principais, IA e A/B) |
| Ferramentas | TypeScript, pnpm, esbuild, Prettier |

## Estrutura

```
mailflow/
├── client/     # aplicação React
├── server/
│   ├── _core/  # inicialização, autenticação e infraestrutura HTTP
│   ├── email/  # adaptadores HTTP dos provedores de envio
│   ├── db.ts   # persistência e consultas Drizzle
│   ├── emailSender.ts # fluxo de campanha, renderização e rastreamento
│   └── routers.ts # endpoints tRPC e validação de entrada
├── shared/     # tipos e validações usados pelos dois lados
├── drizzle/    # schema e migrations
└── todo.md     # roadmap por rodadas (tudo que já foi entregue)
```

O fluxo de envio separa a orquestração da campanha dos adaptadores de provedores. Os adaptadores são testados com respostas HTTP simuladas; os testes não enviam e-mails reais.

## Segurança

- **Links de rastreamento assinados:** abertura, clique e descadastro levam um token HMAC ligado a (campanha, contato, finalidade). IDs sequenciais sozinhos não descadastram ninguém nem inflam métricas, e o descadastro só altera contatos da organização dona da campanha.
- **Credenciais criptografadas:** chave de API e senha SMTP ficam no banco com AES-256-GCM e nunca voltam para o front (aparecem mascaradas).
- **Envio sem duplicidade:** a campanha passa para `sending` de forma atômica; clique duplo ou repetição do agendador não reenviam.
- **Papéis:** enviar ou excluir campanhas e gerenciar credenciais de envio exige papel de administrador da organização.
- **Teste A/B justo:** a amostra e as variantes são sorteadas (Fisher–Yates), não os primeiros contatos da lista.

## Como executar

O login é próprio (e-mail e senha), com senhas armazenadas por hash scrypt e sessão assinada em cookie `HttpOnly`. O cadastro cria automaticamente uma organização com o usuário como administrador. Ainda não há verificação de e-mail nem recuperação de senha.

Para usar MySQL remoto:

1. Crie um banco MySQL e um usuário com permissão para criar e alterar tabelas.
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com a URL fornecida pelo seu provedor. Se ele exigir TLS e usar um certificado confiável pelo sistema, defina `DATABASE_SSL=true`.
3. Gere segredos fortes para `JWT_SECRET` e `TRACKING_SECRET` (mínimo de 32 caracteres); não reutilize os valores de exemplo.
4. Aplique as migrations com `corepack pnpm db:push` e inicie o app.

Não coloque credenciais reais no Git nem as compartilhe no chat. A migration de autenticação adiciona uma chave única para e-mail; confira e resolva eventuais e-mails duplicados em bancos existentes antes de aplicá-la. Contas existentes sem senha local precisam criar uma senha pelo fluxo de cadastro.

### Demonstração local no Windows

É necessário ter Node.js e Corepack. Para instalar o banco gratuito MariaDB Server, abra o PowerShell na raiz do projeto e execute:

```powershell
winget install MariaDB.Server
```

Depois, abra um novo PowerShell na raiz do projeto e execute:

```powershell
corepack pnpm install
.\scripts\setup-local-db.ps1
corepack pnpm db:demo
corepack pnpm dev:demo
```

Abra `http://localhost:3000/login` e entre com `demo@mailflow.local` / `DemoMailflow123!`. O script cria o banco local em `127.0.0.1:3307`, salva segredos aleatórios em `.env.demo` e não altera o `.env` existente. A conta, os contatos e as campanhas são dados fictícios; executar `db:demo` novamente não duplica a conta. Para encerrar o banco, execute `.\scripts\stop-local-db.ps1`.

O agendador local só processa campanhas enquanto o servidor estiver em execução. Sem SendGrid/Mailgun configurado, os envios ficam em modo de demonstração e não enviam e-mails reais.

```bash
pnpm install
Copy-Item .env.example .env   # PowerShell; preencha os valores locais
pnpm db:push     # gera e aplica as migrations
pnpm dev         # servidor de desenvolvimento
pnpm test        # testes com Vitest
pnpm build && pnpm start   # build de produção
```

O projeto não depende de serviços Manus. O assistente de escrita usa regras locais determinísticas (não um modelo generativo), o agendador funciona dentro do processo do servidor e as notificações locais aparecem no log. O envio real de campanhas continua opcional e exige configurar SendGrid ou Mailgun; sem provedor, os envios ficam em modo de demonstração.

### Testes

```bash
pnpm test                                         # unitários (sem banco nem rede)
DATABASE_URL=mysql://user:pass@localhost:3306/mailflow pnpm test   # + integração com MySQL
RUN_NETWORK_TESTS=1 pnpm test                     # + verificação de DNS ao vivo
```

Sem `DATABASE_URL`, as suítes de integração são puladas em vez de falhar.

## Processo de desenvolvimento

Construído em rodadas incrementais: os requisitos e o escopo foram definidos, revisados e validados em cada etapa. O histórico de *checkpoints* está nos commits e o roadmap em `todo.md`.

Depois, uma revisão de segurança do código gerado encontrou e corrigiu: descadastro e métricas forjáveis por IDs sequenciais, cliques atribuídos à campanha errada, provedores não suportados que marcavam e-mails como "entregues", reenvio duplo de campanhas, amostra A/B enviesada, credenciais em texto puro e ações sem checagem de papel. Cada correção tem testes (`server/security.test.ts` e `server/hardening.test.ts`).

## Autora

**Jessica Baptista** · [GitHub](https://github.com/JessicaGPW) · [LinkedIn](https://www.linkedin.com/in/baptistajessica/)

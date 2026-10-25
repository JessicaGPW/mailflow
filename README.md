# MailFlow

**Email marketing platform for managing contacts, building campaigns, and measuring engagement.** MailFlow is an independent, full-stack TypeScript application with local email/password authentication, multi-tenant workspaces, scheduled campaigns, and a visual email editor.

**Plataforma de e-mail marketing para organizar contatos, criar campanhas e acompanhar resultados.** O MailFlow é uma aplicação full-stack independente, com autenticação local, organizações multi-tenant, campanhas agendadas e editor visual.

## Product demo

- **Demo video:** [watch the MailFlow walkthrough](docs/demo.webm) or generate a fresh recording locally.
- **Live preview:** run the sample workspace locally using the steps below. No hosted demo or production sending service is required.

The demo account and all its contacts/campaigns are fictional. Sample campaign metrics are illustrative and do not represent real delivery results. The local sample runs without sending real email.

### Walkthrough script

1. Open the landing page and sign in to the seeded demo account.
2. Show the dashboard and the sample campaign metrics.
3. Open Contacts, filter or inspect a contact profile, then show its list membership.
4. Open Campaigns and explore the visual editor and template gallery.
5. Demonstrate subject suggestions and copy optimization; these run locally using deterministic rules, not a hosted generative AI service.
6. Show campaign scheduling and the reporting screens. Explain that the scheduler processes due campaigns while the server is running.
7. End on the repository and its stack/tests. Do not trigger a real campaign send during the recording.

To record the walkthrough with Microsoft Edge, start the seeded demo as described below, install Playwright's video encoder once with `npx playwright install ffmpeg`, then run `npm run demo:record`. The script records the actual interface flow to `docs/demo.webm` without sending email or saving changes. Replace the recording when you update the product; add a short, optimized GIF or screenshot if a quick preview is useful.

## Features

- Multi-tenant organizations, member roles, and access control
- Contact lists, tags, custom fields, CSV import/export, and engagement profiles
- Dynamic segments and campaign reporting
- Campaign drafts, scheduling, test sends, and A/B testing
- Drag-and-drop email editor and reusable templates
- Local subject-line suggestions and copy editing
- Automation workflows and email engagement tracking
- DNS checks and optional SendGrid/Mailgun sending integrations

## Tech stack

| Area           | Stack                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Front end      | React 19, Vite 8, Tailwind CSS 4, Radix UI                             |
| API            | Express, tRPC, Zod                                                     |
| Persistence    | MySQL/MariaDB, Drizzle ORM                                             |
| Authentication | Local email/password, scrypt password hashes, signed HTTP-only cookies |
| Tests          | Vitest 5, unit tests and MySQL integration tests                       |
| Tooling        | Node.js, npm, TypeScript, esbuild                                      |

## Architecture

```text
client/                 React application and route-level lazy loading
server/
  _core/                HTTP server, local auth, scheduler, and utilities
  email/                SendGrid and Mailgun adapters
  db.ts                 Drizzle queries and persistence
  emailSender.ts        Campaign sending, rendering, and tracking
  routers.ts            Validated tRPC API
  scheduledHandlers.ts  In-process campaign scheduler
shared/                 Shared types and constants
drizzle/                MySQL schema and versioned migrations
scripts/                Local database, demo seed, and full-suite test runner
```

MailFlow does not require Manus, OAuth, a hosted LLM, or a hosted heartbeat service. MySQL/MariaDB is required to persist accounts and campaigns. Sending real email is optional and requires configuring a supported provider.

## Requirements

- Node.js 22.12 or newer
- npm
- MySQL 8+ or MariaDB 10.6+ for the full application and integration tests

The project uses npm and commits `package-lock.json`; pnpm and Corepack are not required.

## Run locally

```powershell
npm ci
Copy-Item .env.example .env
```

Set `DATABASE_URL` to your MySQL/MariaDB connection string. Set distinct, randomly generated `JWT_SECRET` and `TRACKING_SECRET` values (at least 32 characters each); enable `DATABASE_SSL=true` if your database requires TLS. Then:

```powershell
npm run db:push
npm run dev
```

Open `http://localhost:3000`, create an account, and explore the app. Registration creates a workspace and makes its creator an administrator. Email verification and password recovery are not implemented yet.

> Review generated SQL migrations before applying them to an existing or production database. Migrations `0007` and `0008` remove obsolete external-auth and external-scheduler columns while retaining local accounts, password hashes, campaign data, and schedules.

## Seeded local demo (Windows)

The repository includes a PowerShell helper for a disposable MariaDB instance bound to `127.0.0.1:3307`. If MariaDB Server is not installed:

```powershell
winget install MariaDB.Server
```

In a new PowerShell at the repository root, initialize the local database once:

```powershell
npm ci
.\scripts\setup-local-db.ps1
```

Then apply migrations, seed the fictional workspace, and run the app:

```powershell
$env:ENV_FILE = ".env.demo"
npm run db:demo
npm run dev:demo
```

Open `http://localhost:3000/login` and sign in with:

```text
Email:    demo@mailflow.local
Password: DemoMailflow123!
```

The seed creates fictional contacts, a list, and sample sent/draft campaigns. Running it again does not duplicate the demo account. Local database files are stored outside the repository under `%LOCALAPPDATA%\MailFlow\MariaDB`; `.env.demo` is ignored by Git and contains local secrets. Keep the demo server and sample credentials local—do not expose them on a public deployment. Stop the local database with:

```powershell
.\scripts\stop-local-db.ps1
```

## Tests

Fast unit tests require no database or network:

```powershell
npm test
```

Run all tests, including MySQL integration and live DNS checks:

```powershell
$env:ENV_FILE = ".env.demo"
npm run test:all
```

`test:all` requires a reachable MySQL/MariaDB database and internet access for DNS checks. It loads `DATABASE_URL` from `ENV_FILE` (default `.env`), fails clearly if the database URL is missing, and enables the network-only cases. The integration suites create uniquely named test records in that database; use a disposable local database, not production data.

Other useful checks:

```powershell
npm run check
npm run build
npm audit
```

## Security and delivery

- Passwords are stored as scrypt hashes; session tokens are signed and sent in `HttpOnly` cookies.
- Tracking and unsubscribe links use HMAC tokens bound to campaign, contact, and purpose.
- Provider credentials are encrypted at rest with AES-256-GCM and masked in API responses.
- Campaign sends use an atomic claim to prevent accidental duplicate dispatches.
- Sending campaigns and managing provider credentials require organization-admin permissions.
- Configure SPF, DKIM, and DMARC for real sending domains. Never commit credentials or send to real contacts from the demo.

## License and attribution

Copyright © 2026 Jessica Baptista. Released under the [MIT License](LICENSE).

[GitHub](https://github.com/JessicaGPW) · [LinkedIn](https://www.linkedin.com/in/baptistajessica/)

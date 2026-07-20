# MailFlow — Plataforma de E-mail Marketing

## Schema & Database
- [ ] Schema multi-tenant: organizations, organization_members
- [ ] Schema: contacts, contact_lists, contact_list_memberships, contact_tags
- [ ] Schema: contact_custom_fields, contact_custom_field_values
- [ ] Schema: segments, segment_rules
- [ ] Schema: campaigns, campaign_sends, email_templates
- [ ] Schema: automations, automation_steps, automation_enrollments
- [ ] Schema: sending_domains, smtp_configurations
- [ ] Schema: email_events (opens, clicks, bounces, unsubscribes), email_links
- [ ] Gerar migration SQL e aplicar ao banco

## Backend (tRPC procedures)
- [ ] Organization management (create, list, switch)
- [ ] Member management (invite, list, remove, update role)
- [ ] Contact management (CRUD, import CSV, export)
- [ ] List management (CRUD, add/remove contacts)
- [ ] Tag management (add/remove tags)
- [ ] Custom fields management
- [ ] Segment management (CRUD, dynamic rule evaluation)
- [ ] Campaign management (CRUD, schedule, send)
- [ ] Email template management
- [ ] Automation management (CRUD, triggers, steps)
- [ ] Sending domain management (verify DNS)
- [ ] SMTP configuration management
- [ ] Email tracking endpoints (open pixel, click redirect)
- [ ] Dashboard metrics aggregation
- [ ] Owner notifications (bounce alerts, new org signup)

## Frontend
- [ ] Landing page (Home) com design premium
- [ ] Dashboard layout com sidebar navigation
- [ ] Dashboard principal com métricas consolidadas
- [ ] Página de Contatos (lista, busca, filtros, import CSV)
- [ ] Página de Listas (CRUD, membros, importação)
- [ ] Página de Segmentos (CRUD, construtor de regras)
- [ ] Página de Campanhas (lista, criação, agendamento)
- [ ] Editor de e-mail (HTML rico + texto simples)
- [ ] Página de Automações (lista, editor de fluxo)
- [ ] Página de Métricas/Campanha (opens, clicks, bounces)
- [ ] Página de Domínios (configuração DNS, verificação)
- [ ] Página de Configurações SMTP
- [ ] Página de Membros da Organização (convite, papéis)
- [ ] Página de Configurações da Organização

## Testes
- [ ] Testes vitest para procedures principais
- [ ] Validação de fluxos críticos

## Polish & Entrega
- [ ] Design system refinado (cores, tipografia, sombras)
- [ ] Estados de loading/empty/error em todas as páginas
- [ ] Checkpoint final

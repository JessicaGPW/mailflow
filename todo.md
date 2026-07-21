# MailFlow — Plataforma de E-mail Marketing

## Schema & Database
- [x] Schema multi-tenant: organizations, organization_members
- [x] Schema: contacts, contact_lists, contact_list_memberships, contact_tags
- [x] Schema: contact_custom_fields, contact_custom_field_values
- [x] Schema: segments, segment_rules
- [x] Schema: campaigns, campaign_sends, email_templates
- [x] Schema: automations, automation_steps, automation_enrollments
- [x] Schema: sending_domains, smtp_configurations
- [x] Schema: email_events (opens, clicks, bounces, unsubscribes), email_links
- [x] Gerar migration SQL e aplicar ao banco

## Backend (tRPC procedures)
- [x] Organization management (create, list, switch)
- [x] Member management (invite, list, remove, update role)
- [x] Contact management (CRUD, import CSV, export)
- [x] List management (CRUD, add/remove contacts)
- [x] Tag management (add/remove tags)
- [x] Custom fields management
- [x] Segment management (CRUD, dynamic rule evaluation)
- [x] Campaign management (CRUD, schedule, send)
- [x] Email template management
- [x] Automation management (CRUD, triggers, steps)
- [x] Sending domain management (verify DNS)
- [x] SMTP configuration management
- [x] Email tracking endpoints (open pixel, click redirect)
- [x] Dashboard metrics aggregation
- [x] Owner notifications (bounce alerts, new org signup)

## Frontend
- [x] Landing page (Home) com design premium
- [x] Dashboard layout com sidebar navigation
- [x] Dashboard principal com métricas consolidadas
- [x] Página de Contatos (lista, busca, filtros, import CSV)
- [x] Página de Listas (CRUD, membros, importação)
- [x] Página de Segmentos (CRUD, construtor de regras)
- [x] Página de Campanhas (lista, criação, agendamento)
- [x] Editor de e-mail (HTML rico + texto simples)
- [x] Página de Automações (lista, editor de fluxo)
- [x] Página de Métricas/Campanha (opens, clicks, bounces)
- [x] Página de Domínios (configuração DNS, verificação)
- [x] Página de Configurações SMTP
- [x] Página de Membros da Organização (convite, papéis)
- [x] Página de Configurações da Organização

## Testes
- [x] Testes vitest para procedures principais
- [x] Validação de fluxos críticos

## Polish & Entrega
- [x] Design system refinado (cores, tipografia, sombras)
- [x] Estados de loading/empty/error em todas as páginas
- [x] Checkpoint final

## Novas Funcionalidades (Rodada 2)
- [x] Criar skill reutilizável do processo de plataforma de e-mail marketing (/skill-creator)
- [x] Assistente de IA no editor de campanhas: sugerir linhas de assunto atraentes
- [x] Assistente de IA no editor de campanhas: otimizar texto do e-mail
- [x] Construtor visual de e-mails com drag-and-drop (blocos: título, texto, imagem, botão, divisor, espaçador)
- [x] Teste A/B: backend (variantes A/B, divisão de público 50/50, métricas por variante)
- [x] Teste A/B: frontend (criação de variantes de assunto/conteúdo, visualização de resultados com vencedora)
- [x] Testes vitest para novas procedures (IA, A/B) — 16 testes passando
- [x] Checkpoint final das novas funcionalidades

## Novas Funcionalidades (Rodada 3)
- [x] Envio automático da variante vencedora A/B: schema (abTestPercent, abWaitHours, abWinnerSentAt)
- [x] Envio automático da variante vencedora A/B: pipeline (enviar teste para % da base, resto aguarda)
- [x] Envio automático da variante vencedora A/B: job agendado (Heartbeat) que apura vencedora e dispara restante
- [x] Envio automático da variante vencedora A/B: UI no editor (percentual de teste + período de espera)
- [x] Galeria de templates pré-montados no construtor visual (newsletter, promoção, boas-vindas, anúncio)
- [x] Verificação real de DNS: backend com dns.promises.resolveTxt (SPF, DKIM, DMARC)
- [x] Verificação real de DNS: botão "Verificar" na página de domínios com status atualizado
- [x] Testes vitest para novas funcionalidades — 27 testes passando
- [x] Atualizar skill email-marketing-saas-builder com novos padrões
- [x] Checkpoint final da rodada 3

## Novas Funcionalidades (Rodada 4)
- [x] Relatórios comparativos: procedure backend com métricas agregadas por campanha ao longo do tempo
- [x] Relatórios comparativos: página com gráficos de evolução de taxas de abertura/clique e ranking de campanhas
- [x] Relatórios comparativos: rota e entrada no sidebar
- [x] Duplicar campanha: procedure backend (copiar conteúdo, design, configurações — status draft)
- [x] Duplicar campanha: botão na lista de campanhas e na página de detalhe
- [x] Tags e filtros avançados: gerenciamento de tags nos contatos (criar, atribuir, remover)
- [x] Tags e filtros avançados: filtros combinados na página de contatos (tag, lista, status, engajamento)
- [x] Testes vitest para novas funcionalidades — 37 testes passando
- [x] Atualizar skill email-marketing-saas-builder com novos padrões (rodada 4)
- [x] Checkpoint final da rodada 4

## Novas Funcionalidades (Rodada 5)
- [ ] Ações em massa: procedures backend (bulk aplicar tag, bulk adicionar à lista, bulk excluir)
- [ ] Ações em massa: checkboxes na tabela de contatos com barra de ações flutuante
- [ ] E-mail de teste: procedure backend sendTest usando pipeline de envio existente
- [ ] E-mail de teste: botão "Enviar teste" no editor de campanhas com input de destinatário
- [ ] Exportar CSV: procedure backend exportando contatos com filtros ativos aplicados
- [ ] Exportar CSV: botão na página de contatos que baixa o arquivo com os filtros atuais
- [ ] Testes vitest para novas funcionalidades
- [ ] Atualizar skill email-marketing-saas-builder com novos padrões (rodada 5)
- [ ] Checkpoint final da rodada 5

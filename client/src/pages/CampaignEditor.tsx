import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailBuilder, compileToEmailHtml, compileToPlainText, type EmailBlock } from "@/components/EmailBuilder";
import { SubjectSuggestDialog, ContentOptimizeDialog } from "@/components/AiAssistantPanel";
import { TemplateGalleryDialog } from "@/components/EmailTemplateGallery";
import { ArrowLeft, Save, Send, Sparkles, Wand2, FlaskConical, LayoutTemplate, Code, LayoutGrid, MailCheck, CalendarClock, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useParams } from "wouter";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export default function CampaignEditor() {
  const { id } = useParams() as { id?: string };
  const editId = id ? parseInt(id, 10) : null;
  const orgId = useOrgId();
  const utils = trpc.useUtils();

  const { data: lists } = trpc.lists.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const { data: segments } = trpc.segments.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const { data: existingCampaign } = trpc.campaigns.byId.useQuery(
    { orgId: orgId!, id: editId! },
    { enabled: !!orgId && !!editId }
  );

  const [form, setForm] = useState({
    name: "",
    subject: "",
    preheader: "",
    fromName: "",
    fromEmail: "",
    replyTo: "",
    htmlContent: "",
    textContent: "",
    targetListId: undefined as number | undefined,
    targetSegmentId: undefined as number | undefined,
    isAbTest: false,
    abSubjectB: "",
    abHtmlContentB: "",
    abWinnerCriteria: "open_rate" as "open_rate" | "click_rate",
    abAutoWinner: false,
    abTestPercent: 20,
    abWaitHours: 4,
  });

  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [contentMode, setContentMode] = useState<"visual" | "html">("visual");
  const [showSubjectAi, setShowSubjectAi] = useState(false);
  const [showSubjectAiB, setShowSubjectAiB] = useState(false);
  const [showOptimizeAi, setShowOptimizeAi] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const { user } = useAuth();
  const [testEmail, setTestEmail] = useState("");
  const [testVariant, setTestVariant] = useState<"a" | "b">("a");

  useEffect(() => {
    if (user?.email && !testEmail) setTestEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEffect(() => {
    if (existingCampaign) {
      setForm({
        name: existingCampaign.name || "",
        subject: existingCampaign.subject || "",
        preheader: existingCampaign.preheader || "",
        fromName: existingCampaign.fromName || "",
        fromEmail: existingCampaign.fromEmail || "",
        replyTo: existingCampaign.replyTo || "",
        htmlContent: existingCampaign.htmlContent || "",
        textContent: existingCampaign.textContent || "",
        targetListId: existingCampaign.targetListId ?? undefined,
        targetSegmentId: existingCampaign.targetSegmentId ?? undefined,
        isAbTest: existingCampaign.isAbTest ?? false,
        abSubjectB: existingCampaign.abSubjectB || "",
        abHtmlContentB: existingCampaign.abHtmlContentB || "",
        abWinnerCriteria: (existingCampaign.abWinnerCriteria as "open_rate" | "click_rate") || "open_rate",
        abAutoWinner: existingCampaign.abAutoWinner ?? false,
        abTestPercent: existingCampaign.abTestPercent ?? 20,
        abWaitHours: existingCampaign.abWaitHours ?? 4,
      });
      // Restore design blocks if saved
      if (existingCampaign.designJson) {
        try {
          const parsed = JSON.parse(existingCampaign.designJson);
          if (Array.isArray(parsed)) { setBlocks(parsed); setContentMode("visual"); }
        } catch { /* ignore */ }
      } else if (existingCampaign.htmlContent) {
        setContentMode("html");
      }
    }
  }, [existingCampaign]);

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => { toast.success("Campanha criada"); utils.campaigns.list.invalidate(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => { toast.success("Campanha atualizada"); utils.campaigns.list.invalidate(); utils.campaigns.byId.invalidate(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const sendTestMutation = trpc.campaigns.sendTest.useMutation({
    onSuccess: (r) => {
      toast.success(r.sandbox
        ? "E-mail de teste processado em modo sandbox (configure um provedor SMTP para envio real)"
        : "E-mail de teste enviado! Verifique sua caixa de entrada.");
      setShowTestDialog(false);
    },
    onError: (e) => toast.error("Erro no teste: " + e.message),
  });
  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: (data) => {
      toast.success(`Disparo iniciado para ${data.totalRecipients} destinatários` + (form.isAbTest ? ` (A: ${data.variantACount} / B: ${data.variantBCount})` : ""));
      utils.campaigns.list.invalidate();
      utils.campaigns.byId.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const scheduleMutation = trpc.campaigns.schedule.useMutation({
    onSuccess: (c) => {
      toast.success(c?.scheduledAt
        ? `Campanha agendada para ${new Date(c.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
        : "Campanha agendada");
      setShowScheduleDialog(false);
      utils.campaigns.list.invalidate();
      utils.campaigns.byId.invalidate();
    },
    onError: (e) => toast.error("Erro ao agendar: " + e.message),
  });
  const unscheduleMutation = trpc.campaigns.unschedule.useMutation({
    onSuccess: () => {
      toast.success("Agendamento cancelado — a campanha voltou para rascunho");
      utils.campaigns.list.invalidate();
      utils.campaigns.byId.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // Build final payload with compiled HTML from visual builder
  const buildPayload = useCallback(() => {
    let htmlContent = form.htmlContent;
    let textContent = form.textContent;
    let designJson: string | undefined;
    if (contentMode === "visual" && blocks.length > 0) {
      htmlContent = compileToEmailHtml(blocks);
      textContent = textContent || compileToPlainText(blocks);
      designJson = JSON.stringify(blocks);
    }
    return { ...form, htmlContent, textContent, designJson };
  }, [form, blocks, contentMode]);

  const handleSave = useCallback(() => {
    if (!orgId || !form.name || !form.subject) { toast.error("Preencha nome e assunto"); return; }
    if (form.isAbTest && !form.abSubjectB) { toast.error("Teste A/B ativado: preencha o assunto da variante B"); return; }
    const payload = buildPayload();
    if (editId) {
      updateMutation.mutate({ orgId, id: editId, ...payload });
    } else {
      createMutation.mutate({ orgId, ...payload });
    }
  }, [orgId, editId, form, buildPayload, createMutation, updateMutation]);

  const handleSend = useCallback(() => {
    if (!orgId || !editId) return;
    sendMutation.mutate({ orgId, id: editId });
  }, [orgId, editId, sendMutation]);

  const handleSchedule = useCallback(() => {
    if (!orgId || !editId || !scheduleDate || !scheduleTime) {
      toast.error("Escolha a data e o horário do envio");
      return;
    }
    const dt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (isNaN(dt.getTime())) { toast.error("Data/hora inválida"); return; }
    if (dt.getTime() < Date.now() + 60_000) { toast.error("Escolha um horário no futuro"); return; }
    scheduleMutation.mutate({ orgId, id: editId, scheduledAt: dt });
  }, [orgId, editId, scheduleDate, scheduleTime, scheduleMutation]);

  const isScheduled = existingCampaign?.status === "scheduled";

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Link href="/app/campaigns">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-6">
        {editId ? "Editar campanha" : "Nova campanha"}
      </h1>

      <div className="space-y-6">
        {/* Basic info */}
        <Card className="p-6 shadow-premium border-border/50">
          <h2 className="font-semibold mb-4">Informações básicas</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da campanha *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Newsletter de julho" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Assunto *</Label>
                <Button variant="ghost" size="sm" className="h-7 text-primary hover:text-primary" onClick={() => setShowSubjectAi(true)}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Sugerir com IA
                </Button>
              </div>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Novidades importantes para você" />
            </div>
            <div className="space-y-1.5">
              <Label>Preheader</Label>
              <Input value={form.preheader} onChange={e => setForm(p => ({ ...p, preheader: e.target.value }))} placeholder="Texto de pré-visualização do e-mail" />
            </div>
          </div>
        </Card>

        {/* A/B Test */}
        <Card className="p-6 shadow-premium border-border/50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                <FlaskConical className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Teste A/B</h2>
                <p className="text-xs text-muted-foreground">Teste dois assuntos ou conteúdos e descubra qual gera mais engajamento</p>
              </div>
            </div>
            <Switch checked={form.isAbTest} onCheckedChange={v => setForm(p => ({ ...p, isAbTest: v }))} />
          </div>

          {form.isAbTest && (
            <div className="mt-5 space-y-4 pt-4 border-t border-border/50">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/60 p-4 bg-muted/10">
                  <p className="text-xs font-bold text-primary mb-2">VARIANTE A</p>
                  <p className="text-sm font-medium truncate">{form.subject || "Assunto principal (acima)"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Usa o assunto e conteúdo principais da campanha</p>
                </div>
                <div className="rounded-xl border border-primary/30 p-4" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 4%, transparent)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-primary">VARIANTE B</p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary" onClick={() => setShowSubjectAiB(true)}>
                      <Sparkles className="mr-1 h-3 w-3" />
                      IA
                    </Button>
                  </div>
                  <Input
                    value={form.abSubjectB}
                    onChange={e => setForm(p => ({ ...p, abSubjectB: e.target.value }))}
                    placeholder="Assunto alternativo para teste *"
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Critério de vitória</Label>
                  <select
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
                    value={form.abWinnerCriteria}
                    onChange={e => setForm(p => ({ ...p, abWinnerCriteria: e.target.value as "open_rate" | "click_rate" }))}
                  >
                    <option value="open_rate">Maior taxa de abertura</option>
                    <option value="click_rate">Maior taxa de cliques</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Divisão do público</Label>
                  <div className="px-3 py-2 rounded-lg bg-muted text-sm text-muted-foreground">50% variante A · 50% variante B</div>
                </div>
              </div>

              {/* Auto-winner rollout */}
              <div className="rounded-xl border border-border/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Envio automático da vencedora</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Envie o teste para uma parte da base e, após o período definido, a variante vencedora é disparada automaticamente para o restante.</p>
                  </div>
                  <Switch checked={form.abAutoWinner} onCheckedChange={v => setForm(p => ({ ...p, abAutoWinner: v }))} />
                </div>
                {form.abAutoWinner && (
                  <div className="grid md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amostra de teste: {form.abTestPercent}% da base</Label>
                      <input
                        type="range" min={5} max={50} step={5}
                        value={form.abTestPercent}
                        onChange={e => setForm(p => ({ ...p, abTestPercent: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                      <p className="text-[11px] text-muted-foreground">Os {100 - form.abTestPercent}% restantes recebem a vencedora</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Período de teste</Label>
                      <select
                        className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
                        value={form.abWaitHours}
                        onChange={e => setForm(p => ({ ...p, abWaitHours: parseInt(e.target.value) }))}
                      >
                        <option value={1}>1 hora</option>
                        <option value={2}>2 horas</option>
                        <option value={4}>4 horas</option>
                        <option value={8}>8 horas</option>
                        <option value={12}>12 horas</option>
                        <option value={24}>24 horas</option>
                        <option value={48}>48 horas</option>
                      </select>
                      <p className="text-[11px] text-muted-foreground">Após esse período, a vencedora é enviada automaticamente</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conteúdo HTML alternativo da variante B (opcional — se vazio, usa o conteúdo principal)</Label>
                <Textarea
                  rows={4}
                  className="font-mono text-xs"
                  value={form.abHtmlContentB}
                  onChange={e => setForm(p => ({ ...p, abHtmlContentB: e.target.value }))}
                  placeholder="<html>...</html>"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Sender info */}
        <Card className="p-6 shadow-premium border-border/50">
          <h2 className="font-semibold mb-4">Remetente</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome do remetente</Label>
              <Input value={form.fromName} onChange={e => setForm(p => ({ ...p, fromName: e.target.value }))} placeholder="Sua Empresa" />
            </div>
            <div className="space-y-1.5">
              <Label>Email do remetente</Label>
              <Input type="email" value={form.fromEmail} onChange={e => setForm(p => ({ ...p, fromEmail: e.target.value }))} placeholder="contato@suaempresa.com" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Reply-to</Label>
              <Input type="email" value={form.replyTo} onChange={e => setForm(p => ({ ...p, replyTo: e.target.value }))} placeholder="resposta@suaempresa.com" />
            </div>
          </div>
        </Card>

        {/* Target audience */}
        <Card className="p-6 shadow-premium border-border/50">
          <h2 className="font-semibold mb-4">Público-alvo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lista</Label>
              <select className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background" value={form.targetListId ?? ""} onChange={e => setForm(p => ({ ...p, targetListId: e.target.value ? parseInt(e.target.value) : undefined }))}>
                <option value="">Todos os contatos inscritos</option>
                {lists?.map(l => <option key={l.id} value={l.id}>{l.name} ({(l as any).memberCount ?? 0})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Segmento (opcional)</Label>
              <select className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background" value={form.targetSegmentId ?? ""} onChange={e => setForm(p => ({ ...p, targetSegmentId: e.target.value ? parseInt(e.target.value) : undefined }))}>
                <option value="">Nenhum segmento</option>
                {segments?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* Content */}
        <Card className="p-6 shadow-premium border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Conteúdo do e-mail</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => setShowGallery(true)}>
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                Galeria de templates
              </Button>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => setShowOptimizeAi(true)}>
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                Otimizar com IA
              </Button>
            </div>
          </div>

          <Tabs value={contentMode} onValueChange={v => setContentMode(v as "visual" | "html")}>
            <TabsList className="mb-4">
              <TabsTrigger value="visual" className="gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5" />
                Editor visual
              </TabsTrigger>
              <TabsTrigger value="html" className="gap-1.5">
                <Code className="h-3.5 w-3.5" />
                HTML
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual">
              <EmailBuilder blocks={blocks} onChange={setBlocks} />
            </TabsContent>

            <TabsContent value="html">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Conteúdo HTML</Label>
                  <Textarea
                    rows={12}
                    className="font-mono text-sm"
                    value={form.htmlContent}
                    onChange={e => setForm(p => ({ ...p, htmlContent: e.target.value }))}
                    placeholder="<html><body><h1>Olá!</h1><p>Seu conteúdo aqui...</p></body></html>"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Conteúdo texto (alternativo)</Label>
                  <Textarea
                    rows={6}
                    value={form.textContent}
                    onChange={e => setForm(p => ({ ...p, textContent: e.target.value }))}
                    placeholder="Versão em texto simples do seu e-mail"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Scheduled banner */}
        {isScheduled && existingCampaign?.scheduledAt && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex-wrap">
            <CalendarClock className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 flex-1">
              Envio agendado para <strong>{new Date(existingCampaign.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={unscheduleMutation.isPending}
              onClick={() => { if (orgId && editId) unscheduleMutation.mutate({ orgId, id: editId }); }}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              {unscheduleMutation.isPending ? "Cancelando..." : "Cancelar agendamento"}
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 flex-wrap">
          {editId && (
            <Button variant="outline" onClick={() => setShowTestDialog(true)}>
              <MailCheck className="mr-2 h-4 w-4" />
              Enviar teste
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {editId ? "Salvar alterações" : "Salvar rascunho"}
          </Button>
          {editId && !isScheduled && (
            <Button variant="outline" onClick={() => setShowScheduleDialog(true)}>
              <CalendarClock className="mr-2 h-4 w-4" />
              Agendar envio
            </Button>
          )}
          {editId && (
            <Button onClick={handleSend} disabled={sendMutation.isPending} className="shadow-premium">
              <Send className="mr-2 h-4 w-4" />
              {sendMutation.isPending ? "Enviando..." : "Enviar agora"}
            </Button>
          )}
        </div>
      </div>

      {/* Schedule dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar envio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              A campanha será disparada automaticamente na data e horário escolhidos (fuso horário do seu dispositivo). Salve as alterações antes de agendar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setScheduleDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
              </div>
            </div>
            {scheduleDate && scheduleTime && (
              <p className="text-xs text-muted-foreground">
                Envio em: <strong>{new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</strong>
              </p>
            )}
            <Button className="w-full" disabled={scheduleMutation.isPending || !scheduleDate || !scheduleTime} onClick={handleSchedule}>
              <CalendarClock className="mr-2 h-4 w-4" />
              {scheduleMutation.isPending ? "Agendando..." : "Confirmar agendamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test email dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar e-mail de teste</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              O e-mail será enviado com o assunto prefixado com [TESTE], sem gerar métricas nem registros de campanha. Salve as alterações antes de testar.
            </p>
            <div className="space-y-1.5">
              <Label>Destinatário</Label>
              <Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="voce@empresa.com" />
            </div>
            {form.isAbTest && (
              <div className="space-y-1.5">
                <Label>Variante</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={testVariant === "a" ? "default" : "outline"} onClick={() => setTestVariant("a")}>Variante A</Button>
                  <Button type="button" size="sm" variant={testVariant === "b" ? "default" : "outline"} onClick={() => setTestVariant("b")}>Variante B</Button>
                </div>
              </div>
            )}
            <Button
              className="w-full"
              disabled={sendTestMutation.isPending || !testEmail || !editId}
              onClick={() => {
                if (!orgId || !editId) return;
                sendTestMutation.mutate({ orgId, id: editId, to: testEmail, variant: testVariant });
              }}
            >
              <MailCheck className="mr-2 h-4 w-4" />
              {sendTestMutation.isPending ? "Enviando..." : "Enviar teste"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template gallery */}
      <TemplateGalleryDialog
        open={showGallery}
        onOpenChange={setShowGallery}
        onApply={(newBlocks, templateName) => {
          if (blocks.length > 0) {
            const ok = window.confirm("Substituir o conteúdo atual do editor visual pelo template \"" + templateName + "\"?");
            if (!ok) return;
          }
          setBlocks(newBlocks);
          setContentMode("visual");
          toast.success(`Template "${templateName}" aplicado`);
        }}
      />

      {/* AI Dialogs */}
      {orgId && (
        <>
          <SubjectSuggestDialog
            orgId={orgId}
            open={showSubjectAi}
            onOpenChange={setShowSubjectAi}
            defaultTopic={form.name}
            onApply={(subject, preheader) => setForm(p => ({ ...p, subject, preheader: p.preheader || preheader }))}
          />
          <SubjectSuggestDialog
            orgId={orgId}
            open={showSubjectAiB}
            onOpenChange={setShowSubjectAiB}
            defaultTopic={form.name}
            onApply={(subject) => setForm(p => ({ ...p, abSubjectB: subject }))}
          />
          <ContentOptimizeDialog
            orgId={orgId}
            open={showOptimizeAi}
            onOpenChange={setShowOptimizeAi}
            content={contentMode === "visual" && blocks.length > 0 ? compileToPlainText(blocks) : (form.htmlContent || form.textContent)}
            isHtml={contentMode === "html" && !!form.htmlContent}
            onApply={(optimized) => {
              if (contentMode === "html") {
                if (form.htmlContent) setForm(p => ({ ...p, htmlContent: optimized }));
                else setForm(p => ({ ...p, textContent: optimized }));
              } else {
                // Distribute optimized paragraphs back into the text/heading blocks in order
                const paragraphs = optimized.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
                let pi = 0;
                const updated = blocks.map(b => {
                  if ((b.type === "text" || b.type === "heading") && pi < paragraphs.length) {
                    const content = paragraphs[pi++];
                    return { ...b, content } as typeof b;
                  }
                  return b;
                });
                // Any leftover optimized paragraphs become new text blocks at the end
                setBlocks(updated);
                setForm(p => ({ ...p, textContent: optimized }));
                toast.success("Blocos de texto atualizados com a versão otimizada.");
              }
            }}
          />
        </>
      )}
    </div>
  );
}

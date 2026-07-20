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
import { ArrowLeft, Save, Send, Sparkles, Wand2, FlaskConical, LayoutTemplate, Code } from "lucide-react";
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
  });

  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [contentMode, setContentMode] = useState<"visual" | "html">("visual");
  const [showSubjectAi, setShowSubjectAi] = useState(false);
  const [showSubjectAiB, setShowSubjectAiB] = useState(false);
  const [showOptimizeAi, setShowOptimizeAi] = useState(false);

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
  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: (data) => {
      toast.success(`Disparo iniciado para ${data.totalRecipients} destinatários` + (form.isAbTest ? ` (A: ${data.variantACount} / B: ${data.variantBCount})` : ""));
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
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => setShowOptimizeAi(true)}>
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Otimizar com IA
            </Button>
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

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {editId ? "Salvar alterações" : "Salvar rascunho"}
          </Button>
          {editId && (
            <Button onClick={handleSend} disabled={sendMutation.isPending} className="shadow-premium">
              <Send className="mr-2 h-4 w-4" />
              {sendMutation.isPending ? "Enviando..." : "Enviar agora"}
            </Button>
          )}
        </div>
      </div>

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

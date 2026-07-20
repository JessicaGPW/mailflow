import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Send } from "lucide-react";
import { Link, useParams } from "wouter";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";

export default function CampaignEditor() {
  const { id } = useParams();
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
  });

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
      });
    }
  }, [existingCampaign]);

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => { toast.success("Campanha criada"); utils.campaigns.list.invalidate(); },
  });
  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => { toast.success("Campanha atualizada"); utils.campaigns.list.invalidate(); },
  });
  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: () => { toast.success("Disparo iniciado"); utils.campaigns.list.invalidate(); },
  });

  const handleSave = useCallback(() => {
    if (!orgId || !form.name || !form.subject) { toast.error("Preencha nome e assunto"); return; }
    if (editId) {
      updateMutation.mutate({ orgId, id: editId, ...form });
    } else {
      createMutation.mutate({ orgId, ...form });
    }
  }, [orgId, editId, form, createMutation, updateMutation]);

  const handleSend = useCallback(() => {
    if (!orgId || !editId) return;
    sendMutation.mutate({ orgId, id: editId });
  }, [orgId, editId, sendMutation]);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
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
              <Label>Assunto *</Label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Novidades importantes para você" />
            </div>
            <div className="space-y-1.5">
              <Label>Preheader</Label>
              <Input value={form.preheader} onChange={e => setForm(p => ({ ...p, preheader: e.target.value }))} placeholder="Texto de pré-visualização do e-mail" />
            </div>
          </div>
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
                <option value="">Selecione uma lista</option>
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
          <h2 className="font-semibold mb-4">Conteúdo do e-mail</h2>
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
    </div>
  );
}

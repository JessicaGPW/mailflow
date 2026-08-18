import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Server, Plus, Trash2, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const providerLabels: Record<string, string> = {
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  ses: "Amazon SES",
  smtp: "SMTP Customizado",
  mailflow: "Colabix (padrão)",
};

export default function SmtpSettings() {
  const orgId = useOrgId();
  const { data: configs, isLoading } = trpc.smtp.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const utils = trpc.useUtils();

  const createMutation = trpc.smtp.create.useMutation({
    onSuccess: () => { toast.success("Configuração criada"); utils.smtp.list.invalidate(); },
  });
  const deleteMutation = trpc.smtp.delete.useMutation({
    onSuccess: () => { toast.success("Configuração removida"); utils.smtp.list.invalidate(); },
  });
  const updateMutation = trpc.smtp.update.useMutation({
    onSuccess: () => { toast.success("Configuração atualizada"); utils.smtp.list.invalidate(); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newConfig, setNewConfig] = useState({
    provider: "sendgrid" as "sendgrid" | "mailgun" | "ses" | "smtp" | "mailflow",
    name: "",
    apiKey: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    fromEmail: "",
    fromName: "",
    replyTo: "",
    isDefault: false,
  });

  const handleCreate = useCallback(() => {
    if (!orgId || !newConfig.name) return;
    createMutation.mutate({ orgId, ...newConfig }, { onSuccess: () => { setShowAdd(false); setNewConfig({ provider: "sendgrid", name: "", apiKey: "", smtpHost: "", smtpPort: 587, smtpUsername: "", smtpPassword: "", fromEmail: "", fromName: "", replyTo: "", isDefault: false }); } });
  }, [orgId, newConfig, createMutation]);

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id });
  }, [orgId, deleteMutation]);

  const handleSetDefault = useCallback((id: number) => {
    if (!orgId) return;
    updateMutation.mutate({ orgId, id, isDefault: true });
  }, [orgId, updateMutation]);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações SMTP</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure provedores de envio por organização</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="shadow-premium">
              <Plus className="mr-2 h-4 w-4" />
              Nova configuração
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurar provedor SMTP</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Provedor</Label>
                  <select className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background" value={newConfig.provider} onChange={e => setNewConfig(p => ({ ...p, provider: e.target.value as any }))}>
                    <option value="sendgrid">SendGrid</option>
                    <option value="mailgun">Mailgun</option>
                    <option value="ses">Amazon SES</option>
                    <option value="smtp">SMTP Customizado</option>
                    <option value="mailflow">Colabix (padrão)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={newConfig.name} onChange={e => setNewConfig(p => ({ ...p, name: e.target.value }))} placeholder="SendGrid principal" />
                </div>
              </div>

              {(newConfig.provider === "sendgrid" || newConfig.provider === "mailgun" || newConfig.provider === "ses") && (
                <div className="space-y-1.5">
                  <Label>API Key</Label>
                  <Input type="password" value={newConfig.apiKey} onChange={e => setNewConfig(p => ({ ...p, apiKey: e.target.value }))} placeholder="SG.xxxxxxxx" />
                </div>
              )}

              {newConfig.provider === "smtp" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Host SMTP</Label>
                      <Input value={newConfig.smtpHost} onChange={e => setNewConfig(p => ({ ...p, smtpHost: e.target.value }))} placeholder="smtp.suaempresa.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Porta</Label>
                      <Input type="number" value={newConfig.smtpPort} onChange={e => setNewConfig(p => ({ ...p, smtpPort: parseInt(e.target.value) || 587 }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Usuário</Label>
                      <Input value={newConfig.smtpUsername} onChange={e => setNewConfig(p => ({ ...p, smtpUsername: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Senha</Label>
                      <Input type="password" value={newConfig.smtpPassword} onChange={e => setNewConfig(p => ({ ...p, smtpPassword: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email de envio</Label>
                  <Input type="email" value={newConfig.fromEmail} onChange={e => setNewConfig(p => ({ ...p, fromEmail: e.target.value }))} placeholder="noreply@suaempresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome de envio</Label>
                  <Input value={newConfig.fromName} onChange={e => setNewConfig(p => ({ ...p, fromName: e.target.value }))} placeholder="Sua Empresa" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reply-to</Label>
                <Input type="email" value={newConfig.replyTo} onChange={e => setNewConfig(p => ({ ...p, replyTo: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newConfig.isDefault} onChange={e => setNewConfig(p => ({ ...p, isDefault: e.target.checked }))} className="rounded" />
                Definir como provedor padrão
              </label>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Criando..." : "Criar configuração"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : configs && configs.length > 0 ? (
        <div className="space-y-3">
          {configs.map(c => (
            <Card key={c.id} className="p-5 shadow-premium border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{c.name}</p>
                      {c.isDefault && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Padrão</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{providerLabels[c.provider] || c.provider} {c.fromEmail && `· ${c.fromEmail}`}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!c.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(c.id)}>Definir padrão</Button>
                  )}
                  <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <Server className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma configuração SMTP</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Configure um provedor de envio (SendGrid, Mailgun, SES ou SMTP próprio).</p>
        </Card>
      )}
    </div>
  );
}

import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export default function OrgSettings() {
  const orgId = useOrgId();
  const { data: orgs } = trpc.org.list.useQuery();
  const utils = trpc.useUtils();

  const currentOrg = orgs?.find(o => o.id === orgId);
  const updateMutation = trpc.org.update.useMutation({
    onSuccess: () => { toast.success("Configurações salvas"); utils.org.list.invalidate(); },
  });

  const [form, setForm] = useState({
    name: "",
    defaultFromName: "",
    defaultFromEmail: "",
    defaultReplyTo: "",
  });

  useEffect(() => {
    if (currentOrg) {
      setForm({
        name: currentOrg.name || "",
        defaultFromName: currentOrg.defaultFromName || "",
        defaultFromEmail: currentOrg.defaultFromEmail || "",
        defaultReplyTo: currentOrg.defaultReplyTo || "",
      });
    }
  }, [currentOrg]);

  const handleSave = useCallback(() => {
    if (!orgId) return;
    updateMutation.mutate({ orgId, ...form });
  }, [orgId, form, updateMutation]);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie as configurações da sua organização</p>
      </div>

      <div className="space-y-6">
        {/* Organization info */}
        <Card className="p-6 shadow-premium border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Informações da organização</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da organização</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Plano atual</Label>
                <div className="px-3 py-2 rounded-lg bg-muted text-sm text-muted-foreground capitalize">
                  {currentOrg?.plan || "free"}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <div className="px-3 py-2 rounded-lg bg-muted text-sm text-muted-foreground">
                  {currentOrg?.slug || "—"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Default sender settings */}
        <Card className="p-6 shadow-premium border-border/50">
          <h2 className="font-semibold mb-4">Configurações de envio padrão</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome do remetente padrão</Label>
                <Input value={form.defaultFromName} onChange={e => setForm(p => ({ ...p, defaultFromName: e.target.value }))} placeholder="Sua Empresa" />
              </div>
              <div className="space-y-1.5">
                <Label>Email do remetente padrão</Label>
                <Input type="email" value={form.defaultFromEmail} onChange={e => setForm(p => ({ ...p, defaultFromEmail: e.target.value }))} placeholder="noreply@suaempresa.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reply-to padrão</Label>
              <Input type="email" value={form.defaultReplyTo} onChange={e => setForm(p => ({ ...p, defaultReplyTo: e.target.value }))} placeholder="resposta@suaempresa.com" />
            </div>
          </div>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="shadow-premium">
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
}

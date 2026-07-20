import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Workflow, Plus, Trash2, Play, Pause, Mail, Eye, MousePointerClick, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useCallback } from "react";
import { toast } from "sonner";

const triggerIcons: Record<string, typeof Mail> = {
  list_subscription: Mail,
  email_open: Eye,
  link_click: MousePointerClick,
  specific_date: Calendar,
};

const triggerLabels: Record<string, string> = {
  list_subscription: "Inscrição em lista",
  email_open: "Abertura de e-mail",
  link_click: "Clique em link",
  specific_date: "Data específica",
};

export default function Automations() {
  const orgId = useOrgId();
  const { data: automations, isLoading } = trpc.automations.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.automations.delete.useMutation({
    onSuccess: () => { toast.success("Automação removida"); utils.automations.list.invalidate(); },
  });
  const updateMutation = trpc.automations.update.useMutation({
    onSuccess: () => { utils.automations.list.invalidate(); },
  });

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id });
  }, [orgId, deleteMutation]);

  const handleToggle = useCallback((id: number, currentStatus: string) => {
    if (!orgId) return;
    updateMutation.mutate({ orgId, id, status: currentStatus === "active" ? "paused" : "active" });
  }, [orgId, updateMutation]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automações</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie fluxos automatizados baseados em gatilhos</p>
        </div>
        <Link href="/app/automations/new">
          <Button className="shadow-premium">
            <Plus className="mr-2 h-4 w-4" />
            Nova automação
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : automations && automations.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {automations.map(a => {
            const TriggerIcon = triggerIcons[a.triggerType] || Workflow;
            return (
              <Card key={a.id} className="p-5 shadow-premium border-border/50 hover:shadow-premium-lg transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                      <TriggerIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Link href={`/app/automations/${a.id}`}>
                        <h3 className="font-semibold hover:text-primary transition-colors cursor-pointer">{a.name}</h3>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{triggerLabels[a.triggerType]}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggle(a.id, a.status)}
                      className={`p-1.5 rounded transition-colors ${a.status === "active" ? "text-green-600 hover:bg-green-50" : "text-muted-foreground hover:bg-muted"}`}
                      title={a.status === "active" ? "Pausar" : "Ativar"}
                    >
                      {a.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{a.description || "Sem descrição"}</p>
                <div className="mt-3">
                  <Badge variant={a.status === "active" ? "default" : a.status === "paused" ? "secondary" : "outline"} className="text-xs">
                    {a.status === "active" ? "Ativa" : a.status === "paused" ? "Pausada" : "Rascunho"}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <Workflow className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma automação criada</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Crie fluxos automatizados para engajar seus contatos.</p>
          <Link href="/app/automations/new">
            <Button className="mt-4 shadow-premium">
              <Plus className="mr-2 h-4 w-4" />
              Criar automação
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

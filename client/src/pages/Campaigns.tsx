import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Plus, Trash2, Send, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useCallback } from "react";
import { toast } from "sonner";

export default function Campaigns() {
  const orgId = useOrgId();
  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery({ orgId: orgId!, limit: 100, offset: 0 }, { enabled: !!orgId });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => { toast.success("Campanha removida"); utils.campaigns.list.invalidate(); },
  });
  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: () => { toast.success("Disparo iniciado"); utils.campaigns.list.invalidate(); },
    onError: (e) => { toast.error("Erro: " + e.message); },
  });

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id });
  }, [orgId, deleteMutation]);

  const handleSend = useCallback((id: number) => {
    if (!orgId) return;
    sendMutation.mutate({ orgId, id });
  }, [orgId, sendMutation]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie e gerencie suas campanhas de e-mail</p>
        </div>
        <Link href="/app/campaigns/new">
          <Button className="shadow-premium">
            <Plus className="mr-2 h-4 w-4" />
            Nova campanha
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="space-y-2">
          {campaigns.map(c => {
            const openRate = c.totalSent > 0 ? ((c.totalUniqueOpens / c.totalSent) * 100).toFixed(1) : "0.0";
            const clickRate = c.totalSent > 0 ? ((c.totalUniqueClicks / c.totalSent) * 100).toFixed(1) : "0.0";
            return (
              <Card key={c.id} className="p-4 shadow-premium border-border/50 hover:shadow-premium-lg transition-all">
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/app/campaigns/${c.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{c.subject}</p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">{c.totalSent.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">enviados</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">{openRate}%</p>
                      <p className="text-xs text-muted-foreground">abertura</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-medium">{clickRate}%</p>
                      <p className="text-xs text-muted-foreground">cliques</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
                      c.status === "sent" ? "bg-green-50 text-green-700" :
                      c.status === "draft" ? "bg-muted text-muted-foreground" :
                      c.status === "scheduled" ? "bg-blue-50 text-blue-700" :
                      c.status === "sending" ? "bg-amber-50 text-amber-700" :
                      c.status === "failed" ? "bg-red-50 text-red-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {c.status === "sent" ? "Enviada" : c.status === "draft" ? "Rascunho" : c.status === "scheduled" ? "Agendada" : c.status === "sending" ? "Enviando" : c.status === "failed" ? "Falhou" : c.status}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {c.status === "draft" && (
                        <button onClick={() => handleSend(c.id)} className="text-muted-foreground hover:text-primary transition-colors p-1 rounded" title="Enviar agora">
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma campanha criada</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Crie sua primeira campanha para começar a enviar e-mails.</p>
          <Link href="/app/campaigns/new">
            <Button className="mt-4 shadow-premium">
              <Plus className="mr-2 h-4 w-4" />
              Criar campanha
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

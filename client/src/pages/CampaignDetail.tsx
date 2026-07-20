import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Mail, Eye, MousePointerClick, AlertCircle, UserX, Link2, FlaskConical, Trophy } from "lucide-react";
import { Link, useParams } from "wouter";
import { useMemo } from "react";
import { toast } from "sonner";

export default function CampaignDetail() {
  const { id } = useParams() as { id: string };
  const campaignId = parseInt(id, 10);
  const orgId = useOrgId();

  const { data: campaign, isLoading } = trpc.campaigns.byId.useQuery(
    { orgId: orgId!, id: campaignId },
    { enabled: !!orgId && !isNaN(campaignId) }
  );
  const { data: events } = trpc.campaigns.events.useQuery(
    { orgId: orgId!, campaignId, limit: 50 },
    { enabled: !!orgId && !isNaN(campaignId) }
  );
  const { data: links } = trpc.campaigns.links.useQuery(
    { orgId: orgId!, campaignId },
    { enabled: !!orgId && !isNaN(campaignId) }
  );
  const { data: abResults } = trpc.campaigns.abResults.useQuery(
    { orgId: orgId!, campaignId },
    { enabled: !!orgId && !isNaN(campaignId) }
  );

  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: () => toast.success("Disparo iniciado"),
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const metrics = useMemo(() => {
    if (!campaign) return [];
    const sent = campaign.totalSent || 0;
    return [
      { label: "E-mails enviados", value: campaign.totalSent, icon: Send, color: "text-primary" },
      { label: "Entregues", value: campaign.totalDelivered, icon: Mail, color: "text-green-600" },
      { label: "Aberturas únicas", value: campaign.totalUniqueOpens, icon: Eye, color: "text-blue-600", rate: sent > 0 ? `${((campaign.totalUniqueOpens / sent) * 100).toFixed(1)}%` : null },
      { label: "Cliques únicos", value: campaign.totalUniqueClicks, icon: MousePointerClick, color: "text-purple-600", rate: sent > 0 ? `${((campaign.totalUniqueClicks / sent) * 100).toFixed(1)}%` : null },
      { label: "Bounces", value: campaign.totalBounces, icon: AlertCircle, color: "text-red-600", rate: sent > 0 ? `${((campaign.totalBounces / sent) * 100).toFixed(1)}%` : null },
      { label: "Descadastros", value: campaign.totalUnsubscribes, icon: UserX, color: "text-orange-600", rate: sent > 0 ? `${((campaign.totalUnsubscribes / sent) * 100).toFixed(1)}%` : null },
    ];
  }, [campaign]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando campanha...</div>;
  if (!campaign) return <div className="p-8 text-center text-muted-foreground">Campanha não encontrada</div>;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <Link href="/app/campaigns">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <Badge variant={campaign.status === "sent" ? "default" : "secondary"}>
              {campaign.status === "sent" ? "Enviada" : campaign.status === "draft" ? "Rascunho" : campaign.status === "scheduled" ? "Agendada" : campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{campaign.subject}</p>
        </div>
        {campaign.status === "draft" && (
          <Button onClick={() => sendMutation.mutate({ orgId: orgId!, id: campaignId })} disabled={sendMutation.isPending} className="shadow-premium">
            <Send className="mr-2 h-4 w-4" />
            {sendMutation.isPending ? "Enviando..." : "Enviar agora"}
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {metrics.map((m, i) => (
          <Card key={i} className="p-5 shadow-premium border-border/50">
            <div className="flex items-center justify-between mb-2">
              <m.icon className={`h-5 w-5 ${m.color}`} />
              {m.rate && <span className="text-xs font-medium text-muted-foreground">{m.rate}</span>}
            </div>
            <p className="text-2xl font-bold tracking-tight">{m.value.toLocaleString("pt-BR")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{m.label}</p>
          </Card>
        ))}
      </div>

      {/* A/B Test results */}
      {abResults && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold tracking-tight mb-3 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Resultados do Teste A/B
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {(["a", "b"] as const).map(v => {
              const data = abResults[v];
              const isWinner = abResults.winner === v;
              const rate = v === "a" ? abResults.rateA : abResults.rateB;
              const subject = v === "a" ? campaign.subject : campaign.abSubjectB;
              return (
                <Card key={v} className={`p-5 shadow-premium relative overflow-hidden ${isWinner ? "border-primary/50 ring-1 ring-primary/30" : "border-border/50"}`}>
                  {isWinner && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-primary px-2.5 py-1 rounded-full" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                      <Trophy className="h-3 w-3" />
                      Vencedora
                    </div>
                  )}
                  <p className="text-xs font-bold text-primary mb-1">VARIANTE {v.toUpperCase()}</p>
                  <p className="text-sm font-medium mb-4 truncate pr-20">{subject || "—"}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xl font-bold">{data.sent.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">enviados</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{data.uniqueOpens.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">aberturas</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{data.uniqueClicks.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">cliques</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{abResults.criteria === "open_rate" ? "Taxa de abertura" : "Taxa de cliques"}</span>
                      <span className="text-sm font-bold text-primary">{(rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(rate * 100, 100)}%` }} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {abResults.winner === "tie" && (
            <p className="text-sm text-muted-foreground mt-3 text-center">As variantes estão empatadas no critério selecionado.</p>
          )}
        </div>
      )}

      {/* Tracked links */}
      {links && links.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold tracking-tight mb-3">Links rastreados</h2>
          <Card className="shadow-premium border-border/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">URL</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Cliques totais</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Cliques únicos</th>
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-4 py-3 text-sm truncate max-w-xs"><Link2 className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />{l.url}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{l.totalClicks}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{l.uniqueClicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Recent events */}
      {events && events.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-3">Atividade recente</h2>
          <Card className="shadow-premium border-border/50 overflow-hidden">
            <div className="divide-y divide-border/30">
              {events.slice(0, 20).map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    e.type === "open" ? "bg-blue-50 text-blue-600" :
                    e.type === "click" ? "bg-purple-50 text-purple-600" :
                    e.type === "bounce" ? "bg-red-50 text-red-600" :
                    e.type === "unsubscribe" ? "bg-orange-50 text-orange-600" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {e.type === "open" ? <Eye className="h-3.5 w-3.5" /> :
                     e.type === "click" ? <MousePointerClick className="h-3.5 w-3.5" /> :
                     e.type === "bounce" ? <AlertCircle className="h-3.5 w-3.5" /> :
                     e.type === "unsubscribe" ? <UserX className="h-3.5 w-3.5" /> :
                     <Mail className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{e.type === "open" ? "Abertura" : e.type === "click" ? "Clique" : e.type === "bounce" ? "Bounce" : e.type === "unsubscribe" ? "Descadastro" : e.type}</p>
                    {e.url && <p className="text-xs text-muted-foreground truncate">{e.url}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(e.createdAt).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

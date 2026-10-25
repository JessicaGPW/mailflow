import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Mail, Send, MousePointerClick, TrendingUp, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";

export default function Dashboard() {
  const orgId = useOrgId();
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const stats = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: "Contatos totais", value: metrics.totalContacts.toLocaleString("pt-BR"), icon: Users, change: "" },
      { label: "Campanhas enviadas", value: metrics.totalCampaigns.toLocaleString("pt-BR"), icon: Mail, change: "" },
      { label: "E-mails enviados", value: metrics.totalSent.toLocaleString("pt-BR"), icon: Send, change: "" },
      { label: "Taxa de abertura", value: `${metrics.avgOpenRate.toFixed(1)}%`, icon: TrendingUp, change: "" },
      { label: "Taxa de cliques", value: `${metrics.avgClickRate.toFixed(1)}%`, icon: MousePointerClick, change: "" },
      { label: "Bounces", value: metrics.totalBounces.toLocaleString("pt-BR"), icon: AlertCircle, change: "" },
    ];
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da sua conta e performance das campanhas</p>
        </div>
        <Link href="/campaigns/new">
          <Button className="shadow-premium">
            <Mail className="mr-2 h-4 w-4" />
            Nova campanha
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat, i) => (
          <Card key={i} className="p-5 shadow-premium border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                <stat.icon className="h-4.5 w-4.5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Recent campaigns */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Campanhas recentes</h2>
          <Link href="/campaigns">
            <Button variant="ghost" size="sm">Ver todas</Button>
          </Link>
        </div>
        {metrics?.recentCampaigns && metrics.recentCampaigns.length > 0 ? (
          <div className="space-y-2">
            {metrics.recentCampaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="p-4 shadow-premium border-border/50 hover:shadow-premium-lg transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{campaign.subject}</p>
                    </div>
                    <div className="flex items-center gap-6 ml-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium">{campaign.totalSent.toLocaleString("pt-BR")}</p>
                        <p className="text-xs text-muted-foreground">enviados</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{campaign.totalSent > 0 ? ((campaign.totalUniqueOpens / campaign.totalSent) * 100).toFixed(1) : 0}%</p>
                        <p className="text-xs text-muted-foreground">abertura</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        campaign.status === "sent" ? "bg-green-50 text-green-700" :
                        campaign.status === "draft" ? "bg-muted text-muted-foreground" :
                        campaign.status === "scheduled" ? "bg-blue-50 text-blue-700" :
                        campaign.status === "sending" ? "bg-amber-50 text-amber-700" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {campaign.status === "sent" ? "Enviada" :
                         campaign.status === "draft" ? "Rascunho" :
                         campaign.status === "scheduled" ? "Agendada" :
                         campaign.status === "sending" ? "Enviando" :
                         campaign.status === "failed" ? "Falhou" :
                         campaign.status}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-border/50 shadow-premium">
            <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma campanha ainda</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Crie sua primeira campanha para começar a enviar e-mails.</p>
            <Link href="/campaigns/new">
              <Button className="mt-4 shadow-premium">
                <Mail className="mr-2 h-4 w-4" />
                Criar campanha
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Trophy, MousePointerClick, Eye } from "lucide-react";
import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
} from "recharts";
import { Link } from "wouter";

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Reports() {
  const orgId = useOrgId();
  const [limit, setLimit] = useState(20);
  const { data: report, isLoading } = trpc.campaigns.comparisonReport.useQuery(
    { orgId: orgId!, limit },
    { enabled: !!orgId },
  );

  const chartData = (report ?? []).map(c => ({
    name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
    fullName: c.name,
    date: fmtDate(c.sentAt),
    "Taxa de abertura": Number(c.openRate.toFixed(1)),
    "Taxa de clique": Number(c.clickRate.toFixed(1)),
    "Taxa de bounce": Number(c.bounceRate.toFixed(1)),
    Enviados: c.totalSent,
  }));

  const best = report && report.length > 0
    ? [...report].sort((a, b) => b.openRate - a.openRate)[0]
    : null;
  const bestClick = report && report.length > 0
    ? [...report].sort((a, b) => b.clickRate - a.clickRate)[0]
    : null;
  const avgOpen = report && report.length > 0
    ? report.reduce((s, c) => s + c.openRate, 0) / report.length
    : 0;
  const avgClick = report && report.length > 0
    ? report.reduce((s, c) => s + c.clickRate, 0) / report.length
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios comparativos</h1>
          <p className="text-sm text-muted-foreground mt-1">Evolução das taxas de abertura e clique entre campanhas enviadas</p>
        </div>
        <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">Últimas 10 campanhas</SelectItem>
            <SelectItem value="20">Últimas 20 campanhas</SelectItem>
            <SelectItem value="50">Últimas 50 campanhas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : !report || report.length === 0 ? (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma campanha enviada ainda</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Envie campanhas para acompanhar a evolução das métricas aqui.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 shadow-premium border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1.5">
                <Eye className="h-3.5 w-3.5" /> Abertura média
              </div>
              <p className="text-2xl font-bold">{avgOpen.toFixed(1)}%</p>
            </Card>
            <Card className="p-4 shadow-premium border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1.5">
                <MousePointerClick className="h-3.5 w-3.5" /> Clique médio
              </div>
              <p className="text-2xl font-bold">{avgClick.toFixed(1)}%</p>
            </Card>
            <Card className="p-4 shadow-premium border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-500" /> Melhor abertura
              </div>
              <p className="text-lg font-bold truncate" title={best?.name}>{best?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{best ? `${best.openRate.toFixed(1)}%` : ""}</p>
            </Card>
            <Card className="p-4 shadow-premium border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-500" /> Melhor clique
              </div>
              <p className="text-lg font-bold truncate" title={bestClick?.name}>{bestClick?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{bestClick ? `${bestClick.clickRate.toFixed(1)}%` : ""}</p>
            </Card>
          </div>

          {/* Trend line chart */}
          <Card className="p-6 shadow-premium border-border/50">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Evolução das taxas por campanha</h2>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value: number, key: string) => [`${value}%`, key]}
                    labelFormatter={(label, payload) => {
                      const p = payload?.[0]?.payload;
                      return p ? `${p.fullName} — ${p.date}` : label;
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Taxa de abertura" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3.5 }} />
                  <Line type="monotone" dataKey="Taxa de clique" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Volume bar chart */}
          <Card className="p-6 shadow-premium border-border/50">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Volume de envios por campanha</h2>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      const p = payload?.[0]?.payload;
                      return p ? `${p.fullName} — ${p.date}` : label;
                    }}
                  />
                  <Bar dataKey="Enviados" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Ranking table */}
          <Card className="shadow-premium border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border/50">
              <h2 className="font-semibold">Ranking de campanhas por taxa de abertura</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-5 py-3 font-medium">Campanha</th>
                    <th className="px-5 py-3 font-medium">Enviada em</th>
                    <th className="px-5 py-3 font-medium text-right">Enviados</th>
                    <th className="px-5 py-3 font-medium text-right">Abertura</th>
                    <th className="px-5 py-3 font-medium text-right">Clique</th>
                    <th className="px-5 py-3 font-medium text-right">Bounce</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report].sort((a, b) => b.openRate - a.openRate).map((c, i) => (
                    <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-3">
                        <Link href={`/app/campaigns/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(c.sentAt)}</td>
                      <td className="px-5 py-3 text-right">{c.totalSent.toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-3 text-right font-semibold">{c.openRate.toFixed(1)}%</td>
                      <td className="px-5 py-3 text-right font-semibold">{c.clickRate.toFixed(1)}%</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{c.bounceRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

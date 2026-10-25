import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Mail, MousePointerClick, Eye, ListChecks, Tag,
  UserX, AlertTriangle, Send, CalendarClock, User
} from "lucide-react";
import { Link, useParams } from "wouter";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  subscribed: { label: "Inscrito", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  unsubscribed: { label: "Descadastrado", className: "bg-slate-100 text-slate-600 border-slate-200" },
  bounced: { label: "Bounce", className: "bg-amber-50 text-amber-700 border-amber-200" },
  complained: { label: "Reclamação", className: "bg-red-50 text-red-700 border-red-200" },
};

const SEND_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  delivered: "Entregue",
  bounced: "Bounce",
  failed: "Falhou",
};

const EVENT_META: Record<string, { label: string; icon: typeof Eye; className: string }> = {
  open: { label: "Abriu", icon: Eye, className: "bg-blue-50 text-blue-600" },
  click: { label: "Clicou", icon: MousePointerClick, className: "bg-violet-50 text-violet-600" },
  bounce: { label: "Bounce", icon: AlertTriangle, className: "bg-amber-50 text-amber-600" },
  unsubscribe: { label: "Descadastrou", icon: UserX, className: "bg-slate-100 text-slate-600" },
  complain: { label: "Reclamou", icon: AlertTriangle, className: "bg-red-50 text-red-600" },
  delivered: { label: "Entregue", icon: Send, className: "bg-emerald-50 text-emerald-600" },
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ContactProfile() {
  const { id } = useParams() as { id: string };
  const contactId = parseInt(id, 10);
  const orgId = useOrgId();

  const { data: profile, isLoading, error } = trpc.contacts.profile.useQuery(
    { orgId: orgId!, id: contactId },
    { enabled: !!orgId && !!contactId }
  );

  if (isLoading) {
    return <div className="p-6 md:p-8 max-w-5xl mx-auto text-muted-foreground">Carregando perfil...</div>;
  }
  if (error || !profile) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <Link href="/contacts"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button></Link>
        <p className="mt-6 text-muted-foreground">Contato não encontrado.</p>
      </div>
    );
  }

  const { contact, tags, lists, sends, events, customFields, summary } = profile;
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Sem nome";
  const status = STATUS_LABEL[contact.status] ?? STATUS_LABEL.subscribed;
  const openRate = summary.totalReceived > 0 ? Math.round((summary.opens / summary.totalReceived) * 100) : 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <Link href="/contacts">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para contatos
        </Button>
      </Link>

      <Card className="p-6 shadow-premium border-border/50 mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
              <Badge variant="outline" className={status.className}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {contact.email}
              {contact.phone && <span className="ml-3">{contact.phone}</span>}
            </p>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {tags.length > 0 ? tags.map(t => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                  style={{ borderColor: `${t.color}40`, backgroundColor: `${t.color}12`, color: t.color || undefined }}
                >
                  {t.name}
                </span>
              )) : <span className="text-xs text-muted-foreground">Sem tags</span>}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Adicionado em {fmtDate(contact.createdAt)}</p>
            <p className="mt-0.5">Origem: {contact.source || "manual"}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "E-mails recebidos", value: summary.totalReceived, icon: Send },
          { label: "Aberturas", value: summary.opens, icon: Eye },
          { label: "Cliques", value: summary.clicks, icon: MousePointerClick },
          { label: "Taxa de abertura", value: `${openRate}%`, icon: CalendarClock },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4 shadow-premium border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 shadow-premium border-border/50">
          <h2 className="font-semibold mb-4">Histórico de engajamento</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="space-y-0 max-h-[480px] overflow-y-auto pr-1">
              {events.map((ev, i) => {
                const meta = EVENT_META[ev.type] ?? EVENT_META.delivered;
                const Icon = meta.icon;
                return (
                  <div key={ev.id} className="flex gap-3 relative pb-4">
                    {i < events.length - 1 && (
                      <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${meta.className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm">
                        <span className="font-medium">{meta.label}</span>
                        {ev.campaignName && <span className="text-muted-foreground"> — {ev.campaignName}</span>}
                      </p>
                      {ev.url && (
                        <p className="text-xs text-muted-foreground truncate max-w-[280px]" title={ev.url}>{ev.url}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ev.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6 shadow-premium border-border/50">
            <h2 className="font-semibold mb-4">Campanhas recebidas</h2>
            {sends.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma campanha recebida ainda.</p>
            ) : (
              <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                {sends.map(s => (
                  <Link key={s.id} href={`/campaigns/${s.campaignId}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.campaignName}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.subject}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px]">{SEND_STATUS_LABEL[s.status] ?? s.status}{s.variant === "b" ? " · B" : ""}</Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(s.sentAt)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 shadow-premium border-border/50">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><ListChecks className="h-4 w-4" />Listas</h2>
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">Não pertence a nenhuma lista.</p>
            ) : (
              <div className="space-y-2">
                {lists.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{l.name}</span>
                    <span className="text-xs text-muted-foreground">desde {fmtDate(l.subscribedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {customFields.length > 0 && (
            <Card className="p-6 shadow-premium border-border/50">
              <h2 className="font-semibold mb-4">Campos customizados</h2>
              <div className="space-y-2">
                {customFields.map(f => (
                  <div key={f.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{f.name}</span>
                    <span className="font-medium">{f.value || "—"}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

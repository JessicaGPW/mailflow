import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Globe, Plus, Trash2, Check, X, AlertCircle, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

type VerifyResult = {
  spf: { status: string; found: string[]; message: string };
  dkim: { status: string; found: string[]; message: string };
  dmarc: { status: string; found: string[]; message: string };
  allVerified: boolean;
  checkedAt: string;
};

export default function Domains() {
  const orgId = useOrgId();
  const { data: domains, isLoading } = trpc.sendingDomains.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const utils = trpc.useUtils();

  const createMutation = trpc.sendingDomains.create.useMutation({
    onSuccess: () => { toast.success("Domínio adicionado"); utils.sendingDomains.list.invalidate(); },
  });
  const deleteMutation = trpc.sendingDomains.delete.useMutation({
    onSuccess: () => { toast.success("Domínio removido"); utils.sendingDomains.list.invalidate(); },
  });
  const verifyMutation = trpc.sendingDomains.verify.useMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: "", dkimSelector: "mailflow" });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<number, VerifyResult>>({});

  const handleVerify = useCallback((id: number) => {
    if (!orgId) return;
    setVerifyingId(id);
    verifyMutation.mutate({ orgId, id }, {
      onSuccess: (result) => {
        setVerifyResults(prev => ({ ...prev, [id]: result as VerifyResult }));
        setExpandedId(id);
        utils.sendingDomains.list.invalidate();
        if (result.allVerified) {
          toast.success("Todos os registros DNS foram verificados com sucesso!");
        } else {
          const failed = [result.spf.status !== "verified" && "SPF", result.dkim.status !== "verified" && "DKIM", result.dmarc.status !== "verified" && "DMARC"].filter(Boolean).join(", ");
          toast.error(`Verificação falhou: ${failed}. Veja os detalhes abaixo.`);
        }
      },
      onError: (e) => toast.error(e.message || "Erro ao verificar DNS"),
      onSettled: () => setVerifyingId(null),
    });
  }, [orgId, verifyMutation, utils]);

  const handleCreate = useCallback(() => {
    if (!orgId || !newDomain.domain) return;
    createMutation.mutate({ orgId, ...newDomain }, { onSuccess: () => { setShowAdd(false); setNewDomain({ domain: "", dkimSelector: "mailflow" }); } });
  }, [orgId, newDomain, createMutation]);

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id });
  }, [orgId, deleteMutation]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "verified") return <Check className="h-4 w-4 text-green-600" />;
    if (status === "failed") return <X className="h-4 w-4 text-red-600" />;
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domínios de envio</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure domínios próprios com DNS (SPF, DKIM, DMARC)</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="shadow-premium">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar domínio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar domínio</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Domínio *</Label>
                <Input value={newDomain.domain} onChange={e => setNewDomain(p => ({ ...p, domain: e.target.value }))} placeholder="email.suaempresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Seletor DKIM</Label>
                <Input value={newDomain.dkimSelector} onChange={e => setNewDomain(p => ({ ...p, dkimSelector: e.target.value }))} placeholder="mailflow" />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Adicionando..." : "Adicionar domínio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : domains && domains.length > 0 ? (
        <div className="space-y-3">
          {domains.map(d => (
            <Card key={d.id} className="shadow-premium border-border/50 overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{d.domain}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StatusIcon status={d.spfStatus} /> SPF
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StatusIcon status={d.dkimStatus} /> DKIM
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StatusIcon status={d.dmarcStatus} /> DMARC
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleVerify(d.id)} disabled={verifyingId === d.id} className="shadow-premium">
                      {verifyingId === d.id ? (
                        <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Verificando...</>
                      ) : (
                        <><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Verificar DNS</>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                      {expandedId === d.id ? "Ocultar DNS" : "Ver DNS"}
                    </Button>
                    <button onClick={() => handleDelete(d.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === d.id && (
                <div className="border-t border-border/50 bg-muted/20 p-5 space-y-4">
                  <h3 className="text-sm font-semibold">Registros DNS para configurar</h3>

                  {/* SPF */}
                  <div className="bg-card rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">SPF (TXT)</span>
                      <StatusIcon status={d.spfStatus} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Host:</span>
                        <code className="text-xs flex-1 bg-muted px-2 py-1 rounded">{d.domain}</code>
                        <button onClick={() => copyToClipboard(d.domain)} className="text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Valor:</span>
                        <code className="text-xs flex-1 bg-muted px-2 py-1 rounded">v=spf1 include:mailflow.com ~all</code>
                        <button onClick={() => copyToClipboard("v=spf1 include:mailflow.com ~all")} className="text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>

                  {/* DKIM */}
                  <div className="bg-card rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">DKIM (TXT)</span>
                      <StatusIcon status={d.dkimStatus} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Host:</span>
                        <code className="text-xs flex-1 bg-muted px-2 py-1 rounded">{d.dkimSelector || "mailflow"}._domainkey.{d.domain}</code>
                        <button onClick={() => copyToClipboard(`${d.dkimSelector || "mailflow"}._domainkey.${d.domain}`)} className="text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Valor:</span>
                        <code className="text-xs flex-1 bg-muted px-2 py-1 rounded break-all">{d.dkimPublicKey || "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"}</code>
                        <button onClick={() => copyToClipboard(d.dkimPublicKey || "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY")} className="text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>

                  {/* DMARC */}
                  <div className="bg-card rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">DMARC (TXT)</span>
                      <StatusIcon status={d.dmarcStatus} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Host:</span>
                        <code className="text-xs flex-1 bg-muted px-2 py-1 rounded">_dmarc.{d.domain}</code>
                        <button onClick={() => copyToClipboard(`_dmarc.${d.domain}`)} className="text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Valor:</span>
                        <code className="text-xs flex-1 bg-muted px-2 py-1 rounded">v=DMARC1; p=quarantine; rua=mailto:dmarc@{d.domain}; ruf=mailto:dmarc@{d.domain}; fo=1</code>
                        <button onClick={() => copyToClipboard(`v=DMARC1; p=quarantine; rua=mailto:dmarc@${d.domain}; ruf=mailto:dmarc@${d.domain}; fo=1`)} className="text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>

                  {/* Live verification results */}
                  {verifyResults[d.id] && (
                    <div className="bg-card rounded-lg p-4 border border-border/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Resultado da verificação DNS ao vivo</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(verifyResults[d.id].checkedAt).toLocaleString("pt-BR")}</span>
                      </div>
                      {(["spf", "dkim", "dmarc"] as const).map(key => {
                        const check = verifyResults[d.id][key];
                        return (
                          <div key={key} className="flex items-start gap-2.5">
                            <StatusIcon status={check.status} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium uppercase">{key}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                              {check.found.length > 0 && (
                                <code className="block text-[11px] bg-muted px-2 py-1 rounded mt-1 break-all">{check.found[0]}</code>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">Após configurar os registros DNS no seu provedor, clique em “Verificar DNS” para resolver os registros TXT em tempo real e atualizar o status.</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum domínio configurado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Adicione um domínio próprio para enviar e-mails com seu domínio.</p>
        </Card>
      )}
    </div>
  );
}

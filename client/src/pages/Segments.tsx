import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Filter, Plus, Trash2, Users } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export default function Segments() {
  const orgId = useOrgId();
  const { data: segments, isLoading } = trpc.segments.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const utils = trpc.useUtils();

  const createMutation = trpc.segments.create.useMutation({
    onSuccess: () => { toast.success("Segmento criado"); utils.segments.list.invalidate(); },
  });
  const deleteMutation = trpc.segments.delete.useMutation({
    onSuccess: () => { toast.success("Segmento removido"); utils.segments.list.invalidate(); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newSegment, setNewSegment] = useState({ name: "", description: "", matchType: "all" as "all" | "any" });

  const handleCreate = useCallback(() => {
    if (!orgId || !newSegment.name) return;
    const rules = JSON.stringify([{ field: "status", operator: "equals", value: "subscribed" }]);
    createMutation.mutate({ orgId, ...newSegment, rules }, { onSuccess: () => { setShowAdd(false); setNewSegment({ name: "", description: "", matchType: "all" }); } });
  }, [orgId, newSegment, createMutation]);

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id });
  }, [orgId, deleteMutation]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Segmentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie segmentos dinâmicos baseados em atributos e comportamento</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="shadow-premium">
              <Plus className="mr-2 h-4 w-4" />
              Novo segmento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar segmento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={newSegment.name} onChange={e => setNewSegment(p => ({ ...p, name: e.target.value }))} placeholder="Contatos engajados" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea rows={2} value={newSegment.description} onChange={e => setNewSegment(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Correspondência</Label>
                <select className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background" value={newSegment.matchType} onChange={e => setNewSegment(p => ({ ...p, matchType: e.target.value as "all" | "any" }))}>
                  <option value="all">Todas as regras (AND)</option>
                  <option value="any">Qualquer regra (OR)</option>
                </select>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Regras avançadas de segmentação (tags, campos customizados, comportamento) estarão disponíveis no editor detalhado.
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Criando..." : "Criar segmento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : segments && segments.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map(s => (
            <Card key={s.id} className="p-5 shadow-premium border-border/50 hover:shadow-premium-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                  <Filter className="h-5 w-5 text-primary" />
                </div>
                <button onClick={() => handleDelete(s.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="font-semibold text-base mb-1">{s.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{s.description || "Sem descrição"}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{(s as any).contactCount ?? 0} contatos</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-muted">{s.matchType === "all" ? "AND" : "OR"}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <Filter className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum segmento criado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Crie segmentos dinâmicos para agrupar contatos por critérios.</p>
        </Card>
      )}
    </div>
  );
}

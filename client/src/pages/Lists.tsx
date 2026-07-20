import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ListChecks, Plus, Trash2, Users } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export default function Lists() {
  const orgId = useOrgId();
  const { data: lists, isLoading } = trpc.lists.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const utils = trpc.useUtils();

  const createMutation = trpc.lists.create.useMutation({
    onSuccess: () => { toast.success("Lista criada"); utils.lists.list.invalidate(); },
  });
  const deleteMutation = trpc.lists.delete.useMutation({
    onSuccess: () => { toast.success("Lista removida"); utils.lists.list.invalidate(); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newList, setNewList] = useState({ name: "", description: "" });

  const handleCreate = useCallback(() => {
    if (!orgId || !newList.name) return;
    createMutation.mutate({ orgId, ...newList }, { onSuccess: () => { setShowAdd(false); setNewList({ name: "", description: "" }); } });
  }, [orgId, newList, createMutation]);

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id });
  }, [orgId, deleteMutation]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas listas de contatos</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="shadow-premium">
              <Plus className="mr-2 h-4 w-4" />
              Nova lista
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar lista</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={newList.name} onChange={e => setNewList(p => ({ ...p, name: e.target.value }))} placeholder="Newsletter semanal" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea rows={3} value={newList.description} onChange={e => setNewList(p => ({ ...p, description: e.target.value }))} placeholder="Descrição opcional" />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Criando..." : "Criar lista"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : lists && lists.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map(l => (
            <Card key={l.id} className="p-5 shadow-premium border-border/50 hover:shadow-premium-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                  <ListChecks className="h-5 w-5 text-primary" />
                </div>
                <button onClick={() => handleDelete(l.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="font-semibold text-base mb-1">{l.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{l.description || "Sem descrição"}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{(l as any).memberCount ?? 0} contatos</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <ListChecks className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma lista criada</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Crie listas para organizar seus contatos.</p>
        </Card>
      )}
    </div>
  );
}

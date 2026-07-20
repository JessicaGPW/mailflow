import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export default function Templates() {
  const orgId = useOrgId();
  const { data: templates, isLoading } = trpc.templates.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const utils = trpc.useUtils();

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => { toast.success("Template criado"); utils.templates.list.invalidate(); },
  });
  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => { toast.success("Template removido"); utils.templates.list.invalidate(); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", preheader: "", htmlContent: "", textContent: "", category: "" });

  const handleCreate = useCallback(() => {
    if (!orgId || !newTemplate.name) return;
    createMutation.mutate({ orgId, ...newTemplate }, { onSuccess: () => { setShowAdd(false); setNewTemplate({ name: "", subject: "", preheader: "", htmlContent: "", textContent: "", category: "" }); } });
  }, [orgId, newTemplate, createMutation]);

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id });
  }, [orgId, deleteMutation]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Modelos de e-mail reutilizáveis</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="shadow-premium">
              <Plus className="mr-2 h-4 w-4" />
              Novo template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar template</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="Newsletter padrão" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input value={newTemplate.subject} onChange={e => setNewTemplate(p => ({ ...p, subject: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Input value={newTemplate.category} onChange={e => setNewTemplate(p => ({ ...p, category: e.target.value }))} placeholder="Newsletter" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Preheader</Label>
                <Input value={newTemplate.preheader} onChange={e => setNewTemplate(p => ({ ...p, preheader: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo HTML</Label>
                <Textarea rows={8} className="font-mono text-sm" value={newTemplate.htmlContent} onChange={e => setNewTemplate(p => ({ ...p, htmlContent: e.target.value }))} placeholder="<html><body>...</body></html>" />
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo texto</Label>
                <Textarea rows={4} value={newTemplate.textContent} onChange={e => setNewTemplate(p => ({ ...p, textContent: e.target.value }))} />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Criando..." : "Criar template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : templates && templates.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="p-5 shadow-premium border-border/50 hover:shadow-premium-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="font-semibold text-base mb-1">{t.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1">{t.subject || "Sem assunto"}</p>
              {t.category && <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t.category}</span>}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum template criado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Crie modelos reutilizáveis para suas campanhas.</p>
        </Card>
      )}
    </div>
  );
}

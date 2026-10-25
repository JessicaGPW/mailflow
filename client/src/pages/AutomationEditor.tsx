import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Mail, Eye, MousePointerClick, Calendar, Plus, Trash2, Clock, Tag, ListChecks } from "lucide-react";
import { Link, useParams } from "wouter";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

const triggerOptions = [
  { value: "list_subscription", label: "Inscrição em lista", icon: Mail },
  { value: "email_open", label: "Abertura de e-mail", icon: Eye },
  { value: "link_click", label: "Clique em link", icon: MousePointerClick },
  { value: "specific_date", label: "Data específica", icon: Calendar },
];

const stepTypes = [
  { value: "send_email", label: "Enviar e-mail", icon: Mail },
  { value: "wait", label: "Aguardar", icon: Clock },
  { value: "add_tag", label: "Adicionar tag", icon: Tag },
  { value: "remove_tag", label: "Remover tag", icon: Tag },
  { value: "move_to_list", label: "Mover para lista", icon: ListChecks },
];

export default function AutomationEditor() {
  const { id } = useParams();
  const editId = id && id !== "new" ? parseInt(id, 10) : null;
  const orgId = useOrgId();
  const utils = trpc.useUtils();

  const { data: existing } = trpc.automations.byId.useQuery(
    { orgId: orgId!, id: editId! },
    { enabled: !!orgId && !!editId }
  );

  const [form, setForm] = useState({
    name: "",
    description: "",
    triggerType: "list_subscription" as "list_subscription" | "email_open" | "link_click" | "specific_date",
    triggerConfig: "{}",
    steps: [] as Array<{ type: "send_email" | "wait" | "condition" | "add_tag" | "remove_tag" | "move_to_list"; config: string }>,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || "",
        description: existing.description || "",
        triggerType: existing.triggerType,
        triggerConfig: existing.triggerConfig || "{}",
        steps: (existing as any).steps?.map((s: any) => ({ type: s.type, config: s.config })) || [],
      });
    }
  }, [existing]);

  const createMutation = trpc.automations.create.useMutation({
    onSuccess: () => { toast.success("Automação criada"); utils.automations.list.invalidate(); },
  });
  const updateMutation = trpc.automations.update.useMutation({
    onSuccess: () => { toast.success("Automação atualizada"); utils.automations.list.invalidate(); },
  });

  const handleSave = useCallback(() => {
    if (!orgId || !form.name) { toast.error("Preencha o nome"); return; }
    if (editId) {
      updateMutation.mutate({ orgId, id: editId, name: form.name, description: form.description, triggerType: form.triggerType, triggerConfig: form.triggerConfig });
    } else {
      createMutation.mutate({ orgId, name: form.name, description: form.description, triggerType: form.triggerType, triggerConfig: form.triggerConfig, steps: form.steps });
    }
  }, [orgId, editId, form, createMutation, updateMutation]);

  const addStep = () => {
    setForm(p => ({ ...p, steps: [...p.steps, { type: "send_email" as const, config: "{}" }] }));
  };

  const removeStep = (index: number) => {
    setForm(p => ({ ...p, steps: p.steps.filter((_, i) => i !== index) }));
  };

  const updateStep = (index: number, field: "type" | "config", value: string) => {
    setForm(p => ({ ...p, steps: p.steps.map((s, i) => i === index ? { ...s, [field]: value } as typeof s : s) }));
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <Link href="/automations">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-6">
        {editId ? "Editar automação" : "Nova automação"}
      </h1>

      <div className="space-y-6">
        {/* Basic info */}
        <Card className="p-6 shadow-premium border-border/50">
          <h2 className="font-semibold mb-4">Informações básicas</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Boas-vindas" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Sequência de boas-vindas para novos inscritos" />
            </div>
          </div>
        </Card>

        {/* Trigger */}
        <Card className="p-6 shadow-premium border-border/50">
          <h2 className="font-semibold mb-4">Gatilho</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {triggerOptions.map(opt => {
                const selected = form.triggerType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setForm(p => ({ ...p, triggerType: opt.value as any }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                    }`}
                    style={selected ? { backgroundColor: "color-mix(in oklch, var(--primary) 5%, transparent)" } : {}}
                  >
                    <opt.icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label>Configuração do gatilho (JSON)</Label>
              <Textarea rows={3} className="font-mono text-sm" value={form.triggerConfig} onChange={e => setForm(p => ({ ...p, triggerConfig: e.target.value }))} placeholder='{"listId": 1}' />
            </div>
          </div>
        </Card>

        {/* Steps */}
        <Card className="p-6 shadow-premium border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Fluxo de etapas</h2>
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar etapa
            </Button>
          </div>
          {form.steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhuma etapa adicionada. Clique em "Adicionar etapa" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {form.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-border/50 bg-muted/20">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary" style={{ backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 space-y-3">
                    <select
                      className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
                      value={step.type}
                      onChange={e => updateStep(i, "type", e.target.value)}
                    >
                      {stepTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Textarea
                      rows={2}
                      className="font-mono text-xs"
                      value={step.config}
                      onChange={e => updateStep(i, "config", e.target.value)}
                      placeholder='{"subject": "Bem-vindo!", "htmlContent": "..."}'
                    />
                  </div>
                  <button onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="shadow-premium">
            <Save className="mr-2 h-4 w-4" />
            {editId ? "Salvar alterações" : "Criar automação"}
          </Button>
        </div>
      </div>
    </div>
  );
}

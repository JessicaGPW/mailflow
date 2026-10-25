import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Loader2, Check, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Subject suggestions are generated locally without an external AI service.
// ─────────────────────────────────────────────
export function SubjectSuggestDialog({
  orgId,
  open,
  onOpenChange,
  defaultTopic,
  onApply,
}: {
  orgId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTopic?: string;
  onApply: (subject: string, preheader: string) => void;
}) {
  const [topic, setTopic] = useState(defaultTopic || "");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "urgent" | "curious">("professional");
  const [suggestions, setSuggestions] = useState<Array<{ subject: string; preheader: string; rationale: string }>>([]);

  const suggestMutation = trpc.ai.suggestSubjects.useMutation({
    onSuccess: (data) => setSuggestions(data.suggestions),
    onError: (e) => toast.error("Erro ao gerar sugestões: " + e.message),
  });

  const handleGenerate = () => {
    if (!topic.trim()) { toast.error("Descreva o tema do e-mail"); return; }
    suggestMutation.mutate({ orgId, topic, audience: audience || undefined, tone });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugestões de assunto
          </DialogTitle>
          <DialogDescription>
            Sugestões locais prontas para editar. Nenhum serviço externo é usado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Tema do e-mail *</Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Lançamento do novo plano premium com 20% de desconto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Público-alvo</Label>
              <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Gestores de marketing" />
            </div>
            <div className="space-y-1.5">
              <Label>Tom</Label>
              <select className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background" value={tone} onChange={e => setTone(e.target.value as typeof tone)}>
                <option value="professional">Profissional</option>
                <option value="friendly">Amigável</option>
                <option value="urgent">Urgente</option>
                <option value="curious">Curioso</option>
              </select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={suggestMutation.isPending} className="w-full">
            {suggestMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando sugestões...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Gerar 5 sugestões</>
            )}
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-2 pt-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { onApply(s.subject, s.preheader); onOpenChange(false); toast.success("Assunto aplicado"); }}
                  className="w-full text-left p-3.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{s.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.preheader}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1.5 italic">{s.rationale}</p>
                    </div>
                    <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Text cleanup uses deterministic local rules and preserves HTML tags.
// ─────────────────────────────────────────────
export function ContentOptimizeDialog({
  orgId,
  open,
  onOpenChange,
  content,
  isHtml,
  onApply,
}: {
  orgId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  content: string;
  isHtml?: boolean;
  onApply: (optimized: string) => void;
}) {
  const [goal, setGoal] = useState<"clarity" | "engagement" | "conversion" | "shorten">("engagement");
  const [result, setResult] = useState<{ optimized: string; changes: string[] } | null>(null);

  const optimizeMutation = trpc.ai.optimizeContent.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error("Erro ao otimizar: " + e.message),
  });

  const handleOptimize = () => {
    if (!content.trim()) { toast.error("O conteúdo do e-mail está vazio"); return; }
    setResult(null);
    optimizeMutation.mutate({ orgId, content, goal, isHtml });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Revisar texto localmente
          </DialogTitle>
          <DialogDescription>
            Regras locais ajudam a simplificar o texto sem enviar o conteúdo para fora deste servidor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Objetivo da otimização</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "clarity", label: "Clareza" },
                { value: "engagement", label: "Engajamento" },
                { value: "conversion", label: "Conversão" },
                { value: "shorten", label: "Encurtar" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setGoal(opt.value)}
                  className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                    goal === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleOptimize} disabled={optimizeMutation.isPending} className="w-full">
            {optimizeMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Otimizando...</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" /> Otimizar conteúdo</>
            )}
          </Button>

          {result && (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-border/60 p-4 bg-muted/20 max-h-56 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Versão otimizada</p>
                <pre className="text-xs whitespace-pre-wrap font-sans">{result.optimized}</pre>
              </div>
              {result.changes.length > 0 && (
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Principais mudanças</p>
                  <ul className="space-y-1">
                    {result.changes.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={() => { onApply(result.optimized); onOpenChange(false); toast.success("Conteúdo aplicado"); }} className="w-full">
                <Check className="mr-2 h-4 w-4" />
                Aplicar versão otimizada
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

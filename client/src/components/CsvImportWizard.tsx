import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";

/**
 * CSV import wizard with real file upload and a visual column-mapping step.
 *
 * Step 1: pick/drop a .csv file (parsed client-side, RFC-4180-aware)
 * Step 2: map CSV columns to contact fields (email required), preview, import
 */

export type MappedContact = { email: string; firstName?: string; lastName?: string; phone?: string };

const TARGET_FIELDS = [
  { key: "email", label: "E-mail", required: true },
  { key: "firstName", label: "Nome", required: false },
  { key: "lastName", label: "Sobrenome", required: false },
  { key: "phone", label: "Telefone", required: false },
] as const;

type TargetKey = (typeof TARGET_FIELDS)[number]["key"];

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, delimiter sniffing). */
export function parseCsv(text: string): string[][] {
  const nl = text.indexOf("\n");
  const firstLine = text.slice(0, nl === -1 ? text.length : nl);
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best, ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim()); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some(c => c !== "")) rows.push(row);
  return rows;
}

/** Guess mapping from header names (pt/en variants). */
export function guessMapping(headers: string[]): Record<TargetKey, number | null> {
  const norm = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ""));
  const find = (...names: string[]) => {
    const idx = norm.findIndex(h => names.some(n => h.includes(n)));
    return idx === -1 ? null : idx;
  };
  return {
    email: find("email", "mail"),
    firstName: find("firstname", "nome", "first"),
    lastName: find("lastname", "sobrenome", "last", "surname"),
    phone: find("phone", "telefone", "celular", "tel", "mobile"),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CsvImportWizard(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: Array<{ id: number; name: string }> | undefined;
  importing: boolean;
  onImport: (contacts: MappedContact[], listId: number | undefined) => void;
}) {
  const { open, onOpenChange, lists, importing, onImport } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<TargetKey, number | null>>({ email: null, firstName: null, lastName: null, phone: null });
  const [listId, setListId] = useState<number | undefined>();
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep(1); setFileName(""); setRows([]); setHasHeader(true);
    setMapping({ email: null, firstName: null, lastName: null, phone: null });
    setListId(undefined);
  }, []);

  const handleOpenChange = useCallback((o: boolean) => {
    onOpenChange(o);
    if (!o) reset();
  }, [onOpenChange, reset]);

  const loadFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Selecione um arquivo .csv");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").replace(/^\uFEFF/, "");
      const parsed = parseCsv(text);
      if (parsed.length === 0) { toast.error("Arquivo vazio ou inválido"); return; }
      setFileName(file.name);
      setRows(parsed);
      const firstRowHasEmail = parsed[0].some(c => EMAIL_RE.test(c));
      const headerDetected = !firstRowHasEmail;
      setHasHeader(headerDetected);
      const headers = headerDetected ? parsed[0] : parsed[0].map((_, i) => `Coluna ${i + 1}`);
      const guessed = guessMapping(headers);
      if (!headerDetected && guessed.email === null) {
        const idx = parsed[0].findIndex(c => EMAIL_RE.test(c));
        guessed.email = idx === -1 ? null : idx;
      }
      setMapping(guessed);
      setStep(2);
    };
    reader.readAsText(file);
  }, []);

  const headers = useMemo(
    () => rows.length === 0 ? [] : (hasHeader ? rows[0] : rows[0].map((_, i) => `Coluna ${i + 1}`)),
    [rows, hasHeader]
  );
  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  const mappedContacts = useMemo<MappedContact[]>(() => {
    if (mapping.email === null) return [];
    const seen = new Set<string>();
    const out: MappedContact[] = [];
    for (const r of dataRows) {
      const email = (r[mapping.email] || "").toLowerCase();
      if (!EMAIL_RE.test(email) || seen.has(email)) continue;
      seen.add(email);
      out.push({
        email,
        firstName: mapping.firstName !== null ? r[mapping.firstName] || undefined : undefined,
        lastName: mapping.lastName !== null ? r[mapping.lastName] || undefined : undefined,
        phone: mapping.phone !== null ? r[mapping.phone] || undefined : undefined,
      });
    }
    return out;
  }, [dataRows, mapping]);

  const invalidCount = dataRows.length - mappedContacts.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contatos via CSV</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className={`flex items-center gap-1.5 ${step === 1 ? "text-primary font-medium" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>1</span>
            Arquivo
          </span>
          <ArrowRight className="h-3 w-3" />
          <span className={`flex items-center gap-1.5 ${step === 2 ? "text-primary font-medium" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2</span>
            Mapear colunas e importar
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) loadFile(f);
              }}
              className={`w-full rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Clique para selecionar ou arraste o arquivo aqui</p>
                <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .csv, até 10 MB</p>
              </div>
            </button>
            <p className="text-xs text-muted-foreground">
              Dica: exporte sua planilha como CSV. A primeira linha pode conter cabeçalhos (ex.: email, nome, sobrenome, telefone) — detectamos automaticamente e você confirma o mapeamento na próxima etapa.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium truncate max-w-[220px]">{fileName}</span>
                <Badge variant="outline">{dataRows.length} linha(s)</Badge>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
                Primeira linha é cabeçalho
              </label>
            </div>

            <div className="rounded-xl border border-border/60 divide-y divide-border/50">
              {TARGET_FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-28 shrink-0 text-sm font-medium">
                    {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
                  </div>
                  <select
                    className="flex-1 rounded-lg border border-input px-3 py-1.5 text-sm bg-background"
                    value={mapping[f.key] ?? ""}
                    onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value === "" ? null : parseInt(e.target.value) }))}
                  >
                    <option value="">— Não importar —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                  <div className="w-40 shrink-0 text-xs text-muted-foreground truncate hidden sm:block">
                    {mapping[f.key] !== null && dataRows[0] ? `ex.: ${dataRows[0][mapping[f.key]!] || "—"}` : ""}
                  </div>
                </div>
              ))}
            </div>

            {mapping.email !== null && mappedContacts.length > 0 && (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">Pré-visualização (3 primeiros)</div>
                <table className="w-full text-xs">
                  <tbody>
                    {mappedContacts.slice(0, 3).map((c, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-4 py-1.5 font-medium">{c.email}</td>
                        <td className="px-4 py-1.5 text-muted-foreground">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-4 py-1.5 text-muted-foreground">{c.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span><strong>{mappedContacts.length}</strong> contato(s) válidos para importar</span>
              {invalidCount > 0 && <span className="text-muted-foreground">· {invalidCount} linha(s) ignoradas (e-mail inválido ou duplicado)</span>}
            </div>

            <div className="space-y-2">
              <Label>Adicionar à lista (opcional)</Label>
              <select
                className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
                value={listId ?? ""}
                onChange={e => setListId(e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">Nenhuma lista</option>
                {lists?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="shrink-0">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Trocar arquivo
              </Button>
              <Button
                className="flex-1"
                disabled={importing || mapping.email === null || mappedContacts.length === 0}
                onClick={() => onImport(mappedContacts, listId)}
              >
                {importing ? "Importando..." : `Importar ${mappedContacts.length} contato(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


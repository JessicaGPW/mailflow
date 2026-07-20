import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Upload, Search, Trash2 } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";

export default function Contacts() {
  const orgId = useOrgId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const [stableSearch] = useState(() => search);
  const queryParams = useMemo(() => ({
    orgId: orgId!,
    limit,
    offset: page * limit,
    search: search || undefined,
  }), [orgId, page, search]);

  const { data: contacts, isLoading } = trpc.contacts.list.useQuery(queryParams, { enabled: !!orgId });
  const { data: count } = trpc.contacts.count.useQuery({ orgId: orgId! }, { enabled: !!orgId });

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => { toast.success("Contato criado com sucesso"); },
    onError: (e) => { toast.error("Erro ao criar contato: " + e.message); },
  });
  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => { toast.success("Contato removido"); },
  });
  const importMutation = trpc.contacts.import.useMutation({
    onSuccess: (data) => { toast.success(`${data.imported} importados, ${data.updated} atualizados`); },
    onError: (e) => { toast.error("Erro na importação: " + e.message); },
  });

  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newContact, setNewContact] = useState({ email: "", firstName: "", lastName: "", phone: "" });
  const [csvText, setCsvText] = useState("");
  const [importListId, setImportListId] = useState<number | undefined>();

  const { data: lists } = trpc.lists.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });

  const handleCreate = useCallback(() => {
    if (!orgId || !newContact.email) return;
    createMutation.mutate({ orgId, ...newContact }, {
      onSuccess: () => {
        utils.contacts.list.invalidate();
        utils.contacts.count.invalidate();
        setShowAdd(false);
        setNewContact({ email: "", firstName: "", lastName: "", phone: "" });
      },
    });
  }, [orgId, newContact, createMutation, utils]);

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id }, {
      onSuccess: () => {
        utils.contacts.list.invalidate();
        utils.contacts.count.invalidate();
      },
    });
  }, [orgId, deleteMutation, utils]);

  const handleImport = useCallback(() => {
    if (!orgId || !csvText.trim()) return;
    const lines = csvText.trim().split("\n");
    const parsed = lines.map(line => {
      const [email, firstName, lastName, phone] = line.split(",").map(s => s?.trim());
      return { email: email || "", firstName, lastName, phone };
    }).filter(c => c.email);
    if (parsed.length === 0) { toast.error("Nenhum contato válido encontrado"); return; }
    importMutation.mutate({ orgId, contacts: parsed, listId: importListId }, {
      onSuccess: () => {
        utils.contacts.list.invalidate();
        utils.contacts.count.invalidate();
        setShowImport(false);
        setCsvText("");
      },
    });
  }, [orgId, csvText, importListId, importMutation, utils]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
          <p className="text-sm text-muted-foreground mt-1">{count?.toLocaleString("pt-BR") || 0} contatos no total</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showImport} onOpenChange={setShowImport}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-premium">
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Importar contatos via CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Adicionar à lista (opcional)</Label>
                  <select
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
                    value={importListId ?? ""}
                    onChange={e => setImportListId(e.target.value ? parseInt(e.target.value) : undefined)}
                  >
                    <option value="">Nenhuma lista</option>
                    {lists?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Contatos (formato: email, nome, sobrenome, telefone)</Label>
                  <Textarea
                    rows={8}
                    placeholder="joao@exemplo.com, João, Silva, +5511999999999&#10;maria@exemplo.com, Maria, Santos"
                    value={csvText}
                    onChange={e => setCsvText(e.target.value)}
                  />
                </div>
                <Button onClick={handleImport} disabled={importMutation.isPending} className="w-full">
                  {importMutation.isPending ? "Importando..." : `Importar ${csvText.trim().split("\n").filter(l => l.trim()).length} contatos`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="shadow-premium">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar contato</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} placeholder="contato@exemplo.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={newContact.firstName} onChange={e => setNewContact(p => ({ ...p, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sobrenome</Label>
                    <Input value={newContact.lastName} onChange={e => setNewContact(p => ({ ...p, lastName: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} placeholder="+55 11 99999-9999" />
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Adicionando..." : "Adicionar contato"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar por email, nome..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {/* Table */}
      <Card className="shadow-premium border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Origem</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : contacts && contacts.length > 0 ? (
                contacts.map(c => (
                  <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === "subscribed" ? "default" : c.status === "bounced" ? "destructive" : "secondary"} className="text-xs">
                        {c.status === "subscribed" ? "Inscrito" : c.status === "unsubscribed" ? "Descadastrado" : c.status === "bounced" ? "Bounce" : "Reclamação"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{c.source}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Nenhum contato encontrado</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Adicione contatos manualmente ou importe via CSV.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {contacts && contacts.length === limit && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}

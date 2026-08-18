import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Plus, Upload, Search, Trash2, Tag, X, SlidersHorizontal, Download, ListChecks } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { CsvImportWizard, type MappedContact } from "@/components/CsvImportWizard";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";

const TAG_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#be185d"];

export default function Contacts() {
  const orgId = useOrgId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [filterListId, setFilterListId] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<"subscribed" | "unsubscribed" | "bounced" | "complained" | undefined>();
  const [filterEngagement, setFilterEngagement] = useState<"opened" | "clicked" | "no_engagement" | undefined>();
  const limit = 50;

  const queryParams = useMemo(() => ({
    orgId: orgId!,
    limit,
    offset: page * limit,
    search: search || undefined,
    tagIds: filterTagIds.length > 0 ? filterTagIds : undefined,
    listId: filterListId,
    status: filterStatus,
    engagement: filterEngagement,
  }), [orgId, page, search, filterTagIds, filterListId, filterStatus, filterEngagement]);

  const { data, isLoading } = trpc.contacts.listAdvanced.useQuery(queryParams, { enabled: !!orgId });
  const contacts = data?.contacts;
  const total = data?.total ?? 0;

  const { data: lists } = trpc.lists.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const { data: allTags } = trpc.tags.list.useQuery({ orgId: orgId! }, { enabled: !!orgId });

  const utils = trpc.useUtils();

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
  const createTagMutation = trpc.tags.create.useMutation({
    onSuccess: () => { toast.success("Tag criada"); utils.tags.list.invalidate(); },
    onError: (e) => { toast.error("Erro ao criar tag: " + e.message); },
  });
  const deleteTagMutation = trpc.tags.delete.useMutation({
    onSuccess: () => { toast.success("Tag removida"); utils.tags.list.invalidate(); utils.contacts.listAdvanced.invalidate(); },
  });
  const addTagMutation = trpc.tags.addToContact.useMutation({
    onSuccess: () => { utils.contacts.listAdvanced.invalidate(); },
    onError: (e) => { toast.error("Erro: " + e.message); },
  });
  const bulkAddTagMutation = trpc.contacts.bulkAddTag.useMutation({
    onSuccess: (r) => { toast.success(`Tag aplicada a ${r.affected} contato(s)`); utils.contacts.listAdvanced.invalidate(); setSelectedIds(new Set()); },
    onError: (e) => { toast.error("Erro: " + e.message); },
  });
  const bulkAddToListMutation = trpc.contacts.bulkAddToList.useMutation({
    onSuccess: (r) => { toast.success(`${r.affected} contato(s) adicionados à lista`); utils.contacts.listAdvanced.invalidate(); setSelectedIds(new Set()); },
    onError: (e) => { toast.error("Erro: " + e.message); },
  });
  const bulkDeleteMutation = trpc.contacts.bulkDelete.useMutation({
    onSuccess: (r) => { toast.success(`${r.affected} contato(s) excluídos`); utils.contacts.listAdvanced.invalidate(); setSelectedIds(new Set()); },
    onError: (e) => { toast.error("Erro: " + e.message); },
  });
  const exportCsvMutation = trpc.contacts.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob(["\uFEFF" + data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com sucesso");
    },
    onError: (e) => { toast.error("Erro ao exportar: " + e.message); },
  });
  const removeTagMutation = trpc.tags.removeFromContact.useMutation({
    onSuccess: () => { utils.contacts.listAdvanced.invalidate(); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newContact, setNewContact] = useState({ email: "", firstName: "", lastName: "", phone: "" });
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const activeFilterCount = (filterTagIds.length > 0 ? 1 : 0) + (filterListId ? 1 : 0) + (filterStatus ? 1 : 0) + (filterEngagement ? 1 : 0);

  const resetPageAnd = useCallback(<T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0); }, []);

  const handleCreate = useCallback(() => {
    if (!orgId || !newContact.email) return;
    createMutation.mutate({ orgId, ...newContact }, {
      onSuccess: () => {
        utils.contacts.listAdvanced.invalidate();
        setShowAdd(false);
        setNewContact({ email: "", firstName: "", lastName: "", phone: "" });
      },
    });
  }, [orgId, newContact, createMutation, utils]);

  const handleDelete = useCallback((id: number) => {
    if (!orgId) return;
    deleteMutation.mutate({ orgId, id }, {
      onSuccess: () => { utils.contacts.listAdvanced.invalidate(); },
    });
  }, [orgId, deleteMutation, utils]);

  const handleImport = useCallback((mapped: MappedContact[], listId: number | undefined) => {
    if (!orgId || mapped.length === 0) return;
    importMutation.mutate({ orgId, contacts: mapped, listId }, {
      onSuccess: () => {
        utils.contacts.listAdvanced.invalidate();
        setShowImport(false);
      },
    });
  }, [orgId, importMutation, utils]);

  const handleCreateTag = useCallback(() => {
    if (!orgId || !newTagName.trim()) return;
    createTagMutation.mutate({ orgId, name: newTagName.trim(), color: newTagColor }, {
      onSuccess: () => setNewTagName(""),
    });
  }, [orgId, newTagName, newTagColor, createTagMutation]);

  const toggleFilterTag = useCallback((tagId: number) => {
    setFilterTagIds(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilterTagIds([]);
    setFilterListId(undefined);
    setFilterStatus(undefined);
    setFilterEngagement(undefined);
    setPage(0);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const pageIds = useMemo(() => (contacts ?? []).map(c => c.id), [contacts]);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (pageIds.every(id => next.has(id))) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [pageIds]);

  const handleExportCsv = useCallback(() => {
    if (!orgId) return;
    exportCsvMutation.mutate({
      orgId,
      search: search || undefined,
      tagIds: filterTagIds.length > 0 ? filterTagIds : undefined,
      listId: filterListId,
      status: filterStatus,
      engagement: filterEngagement,
    });
  }, [orgId, search, filterTagIds, filterListId, filterStatus, filterEngagement, exportCsvMutation]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
          <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString("pt-BR")} contatos {activeFilterCount > 0 ? "encontrados" : "no total"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="shadow-premium" onClick={handleExportCsv} disabled={exportCsvMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {exportCsvMutation.isPending ? "Exportando..." : "Exportar CSV"}
          </Button>
          <Dialog open={showTagManager} onOpenChange={setShowTagManager}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-premium">
                <Tag className="mr-2 h-4 w-4" />
                Gerenciar tags
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Gerenciar tags</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex gap-2">
                  <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Nome da tag" onKeyDown={e => e.key === "Enter" && handleCreateTag()} />
                  <Button onClick={handleCreateTag} disabled={createTagMutation.isPending || !newTagName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${newTagColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allTags && allTags.length > 0 ? allTags.map(t => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color || "#888" }} />
                        {t.name}
                      </span>
                      <button onClick={() => deleteTagMutation.mutate({ orgId: orgId!, id: t.id })} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag criada ainda</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="shadow-premium" onClick={() => setShowImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <CsvImportWizard
            open={showImport}
            onOpenChange={setShowImport}
            lists={lists}
            importing={importMutation.isPending}
            onImport={handleImport}
          />
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

      {/* Search + filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Buscar por email, nome..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={filterListId ? String(filterListId) : "all"} onValueChange={v => { setFilterListId(v === "all" ? undefined : Number(v)); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Lista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as listas</SelectItem>
            {lists?.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus ?? "all"} onValueChange={v => { setFilterStatus(v === "all" ? undefined : v as any); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="subscribed">Inscrito</SelectItem>
            <SelectItem value="unsubscribed">Descadastrado</SelectItem>
            <SelectItem value="bounced">Bounce</SelectItem>
            <SelectItem value="complained">Reclamação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEngagement ?? "all"} onValueChange={v => { setFilterEngagement(v === "all" ? undefined : v as any); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Engajamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer engajamento</SelectItem>
            <SelectItem value="opened">Abriu algum e-mail</SelectItem>
            <SelectItem value="clicked">Clicou em algum link</SelectItem>
            <SelectItem value="no_engagement">Sem engajamento</SelectItem>
          </SelectContent>
        </Select>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="mr-1 h-3.5 w-3.5" />
            Limpar filtros ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Tag filter chips */}
      {allTags && allTags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {allTags.map(t => {
            const active = filterTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleFilterTag(t.id)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                  active ? "text-white border-transparent shadow-sm" : "bg-card text-muted-foreground border-border/60 hover:border-border"
                }`}
                style={active ? { backgroundColor: t.color || "#2563eb" } : undefined}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "rgba(255,255,255,0.8)" : (t.color || "#888") }} />
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 flex-wrap">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selecionado(s)</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            {allTags && allTags.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tag className="mr-1.5 h-3.5 w-3.5" />
                    Aplicar tag
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-0.5">
                    {allTags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => bulkAddTagMutation.mutate({ orgId: orgId!, contactIds: Array.from(selectedIds), tagId: t.id })}
                        disabled={bulkAddTagMutation.isPending}
                        className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || "#888" }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {lists && lists.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar à lista
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="end">
                  <div className="space-y-0.5">
                    {lists.map(l => (
                      <button
                        key={l.id}
                        onClick={() => bulkAddToListMutation.mutate({ orgId: orgId!, contactIds: Array.from(selectedIds), listId: l.id })}
                        disabled={bulkAddToListMutation.isPending}
                        className="w-full text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50 truncate"
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Excluir ${selectedIds.size} contato(s)? Esta ação não pode ser desfeita.`)) {
                  bulkDeleteMutation.mutate({ orgId: orgId!, contactIds: Array.from(selectedIds) });
                }
              }}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {bulkDeleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="shadow-premium border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" />
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Tags</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : contacts && contacts.length > 0 ? (
                contacts.map(c => (
                  <tr key={c.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${selectedIds.has(c.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-3">
                      <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} aria-label={`Selecionar ${c.email}`} />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link href={`/app/contacts/${c.id}`} className="hover:text-primary hover:underline underline-offset-2 transition-colors">
                        {c.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {c.tags.map(t => (
                          <span key={t.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium text-white group/tag" style={{ backgroundColor: t.color || "#888" }}>
                            {t.name}
                            <button
                              onClick={() => removeTagMutation.mutate({ orgId: orgId!, contactId: c.id, tagId: t.id })}
                              className="opacity-60 hover:opacity-100"
                              title="Remover tag"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                        {allTags && allTags.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors" title="Adicionar tag">
                                <Plus className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                              <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">Adicionar tag</p>
                              <div className="space-y-0.5">
                                {allTags.filter(t => !c.tags.some(ct => ct.id === t.id)).map(t => (
                                  <button
                                    key={t.id}
                                    onClick={() => addTagMutation.mutate({ orgId: orgId!, contactId: c.id, tagId: t.id })}
                                    className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                                  >
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || "#888" }} />
                                    {t.name}
                                  </button>
                                ))}
                                {allTags.filter(t => !c.tags.some(ct => ct.id === t.id)).length === 0 && (
                                  <p className="text-xs text-muted-foreground px-2 py-1">Todas as tags já aplicadas</p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === "subscribed" ? "default" : c.status === "bounced" ? "destructive" : "secondary"} className="text-xs">
                        {c.status === "subscribed" ? "Inscrito" : c.status === "unsubscribed" ? "Descadastrado" : c.status === "bounced" ? "Bounce" : "Reclamação"}
                      </Badge>
                    </td>
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
                  <td colSpan={6} className="text-center py-16">
                    <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Nenhum contato encontrado</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      {activeFilterCount > 0 ? "Ajuste os filtros ou limpe-os para ver todos os contatos." : "Adicione contatos manualmente ou importe via CSV."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-muted-foreground">
          Mostrando {contacts?.length ?? 0} de {total.toLocaleString("pt-BR")}
        </p>
        <div className="flex gap-2">
          {page > 0 && (
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
          )}
          {(page + 1) * limit < total && (
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
              Próxima
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

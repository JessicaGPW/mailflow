import { useOrgId } from "@/hooks/useOrg";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCog, Plus, Trash2, UserPlus } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export default function Team() {
  const orgId = useOrgId();
  const { data: members, isLoading } = trpc.org.members.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const utils = trpc.useUtils();

  const inviteMutation = trpc.org.inviteMember.useMutation({
    onSuccess: (data: any) => {
      if (data?.status === "invited") {
        toast.success("Convite enviado para " + data.email);
      } else {
        toast.success("Membro adicionado");
      }
      utils.org.members.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const removeMutation = trpc.org.removeMember.useMutation({
    onSuccess: () => { toast.success("Membro removido"); utils.org.members.invalidate(); },
  });
  const updateMutation = trpc.org.updateMember.useMutation({
    onSuccess: () => { toast.success("Papel atualizado"); utils.org.members.invalidate(); },
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  const handleInvite = useCallback(() => {
    if (!orgId || !inviteEmail) return;
    inviteMutation.mutate({ orgId, email: inviteEmail, role: inviteRole }, { onSuccess: () => { setShowInvite(false); setInviteEmail(""); } });
  }, [orgId, inviteEmail, inviteRole, inviteMutation]);

  const handleRemove = useCallback((userId: number) => {
    if (!orgId) return;
    removeMutation.mutate({ orgId, userId });
  }, [orgId, removeMutation]);

  const handleRoleChange = useCallback((userId: number, role: "admin" | "member") => {
    if (!orgId) return;
    updateMutation.mutate({ orgId, userId, role });
  }, [orgId, updateMutation]);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie membros e permissões da organização</p>
        </div>
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogTrigger asChild>
            <Button className="shadow-premium">
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar membro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Convidar membro</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colega@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <select className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background" value={inviteRole} onChange={e => setInviteRole(e.target.value as "admin" | "member")}>
                  <option value="member">Membro</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <Button onClick={handleInvite} disabled={inviteMutation.isPending} className="w-full">
                {inviteMutation.isPending ? "Enviando..." : "Enviar convite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : members && members.length > 0 ? (
        <Card className="shadow-premium border-border/50 overflow-hidden">
          <div className="divide-y divide-border/30">
            {members.map((m: any) => (
              <div key={m.member.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                <Avatar className="h-10 w-10 border">
                  <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                    {m.user?.name?.charAt(0).toUpperCase() || m.user?.email?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.user?.name || m.member.invitedEmail || "Usuário convidado"}</p>
                  <p className="text-sm text-muted-foreground truncate">{m.user?.email || m.member.invitedEmail}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.member.status === "invited" && <Badge variant="outline" className="text-xs">Convidado</Badge>}
                  <select
                    className="rounded-lg border border-input px-2.5 py-1.5 text-sm bg-background"
                    value={m.member.role}
                    onChange={e => handleRoleChange(m.member.userId, e.target.value as "admin" | "member")}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Membro</option>
                  </select>
                  <button onClick={() => handleRemove(m.member.userId)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center border-border/50 shadow-premium">
          <UserCog className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum membro na equipe</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Convide membros para colaborar na sua organização.</p>
        </Card>
      )}
    </div>
  );
}

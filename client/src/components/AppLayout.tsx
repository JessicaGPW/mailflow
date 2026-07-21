import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Filter,
  Mail,
  Workflow,
  FileText,
  BarChart3,
  Globe,
  Server,
  Settings,
  UserCog,
  LogOut,
  PanelLeft,
  ChevronDown,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { trpc } from "@/lib/trpc";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/app" },
  { icon: Users, label: "Contatos", path: "/app/contacts" },
  { icon: ListChecks, label: "Listas", path: "/app/lists" },
  { icon: Filter, label: "Segmentos", path: "/app/segments" },
  { icon: Mail, label: "Campanhas", path: "/app/campaigns" },
  { icon: Workflow, label: "Automações", path: "/app/automations" },
  { icon: BarChart3, label: "Relatórios", path: "/app/reports" },
  { icon: FileText, label: "Templates", path: "/app/templates" },
  { icon: Globe, label: "Domínios", path: "/app/domains" },
  { icon: Server, label: "Configurações SMTP", path: "/app/smtp" },
  { icon: UserCog, label: "Equipe", path: "/app/team" },
  { icon: Settings, label: "Configurações", path: "/app/settings" },
];

const SIDEBAR_WIDTH_KEY = "mailflow-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-premium-lg">
              <Mail className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Acesse sua conta
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Entre para acessar o painel do MailFlow e gerenciar suas campanhas de e-mail marketing.
            </p>
          </div>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full shadow-premium hover:shadow-premium-lg transition-all"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen overflow-hidden bg-background"
      style={{ "--sidebar-w": `${sidebarWidth}px` } as CSSProperties}
    >
      <AppLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </AppLayoutContent>
    </div>
  );
}

type AppLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function AppLayoutContent({ children, setSidebarWidth }: AppLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Get user's organizations
  const { data: orgs } = trpc.org.list.useQuery();
  const [currentOrgId, setCurrentOrgId] = useState<number | null>(null);

  useEffect(() => {
    if (orgs && orgs.length > 0 && currentOrgId === null) {
      setCurrentOrgId(orgs[0].id);
    }
  }, [orgs, currentOrgId]);

  // Store current org in localStorage for child pages
  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem("mailflow-current-org", String(currentOrgId));
    }
  }, [currentOrgId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const currentOrg = orgs?.find(o => o.id === currentOrgId);
  const activeMenuItem = menuItems.find(item => {
    if (item.path === "/app") return location === "/app";
    return location.startsWith(item.path);
  });

  const sidebar = (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 h-16 px-5 border-b border-sidebar-border shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-premium">
          <Mail className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold tracking-tight text-sidebar-foreground text-[15px]">MailFlow</span>
        </div>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors"
          >
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Organization switcher */}
      {orgs && orgs.length > 0 && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2.5 hover:bg-sidebar-accent transition-colors text-left group">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary">
                    {currentOrg?.name?.charAt(0).toUpperCase() || "O"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-sidebar-foreground">
                    {currentOrg?.name || "Organização"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {currentOrg?.plan === "free" ? "Plano Free" : currentOrg?.plan === "pro" ? "Plano Pro" : currentOrg?.plan || "Free"}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
              {orgs.map(org => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => setCurrentOrgId(org.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-primary">
                        {org.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate">{org.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {menuItems.map(item => {
            const isActive = item.path === "/app"
              ? location === "/app"
              : location.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  setLocation(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-primary/8 text-primary font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
                style={isActive ? { backgroundColor: "color-mix(in oklch, var(--primary) 8%, transparent)" } : {}}
              >
                <item.icon
                  className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary" : ""}`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left">
              <Avatar className="h-8 w-8 border shrink-0">
                <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-sidebar-foreground leading-none">
                  {user?.name || "Usuário"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-1">
                  {user?.email || ""}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => setLocation("/app/settings")}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      {!isMobile && (
        <div className="relative shrink-0" ref={sidebarRef} style={{ width: `var(--sidebar-w)` }}>
          {sidebar}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            style={{ zIndex: 50 }}
          />
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-[260px] shrink-0">{sidebar}</div>
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background px-3 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="h-9 w-9 rounded-lg hover:bg-accent flex items-center justify-center transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">{activeMenuItem?.label ?? "MailFlow"}</span>
            <div className="w-9" />
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}

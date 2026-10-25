import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Send,
  BarChart3,
  Users,
  Workflow,
  Globe,
  Shield,
  Zap,
  ArrowRight,
  Check,
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-premium">
              <Mail className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">
              MailFlow
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/app">
                <Button size="sm" className="shadow-premium">
                  Ir para painel
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  (window.location.href = isAuthenticated ? "/app" : "/login")
                }
                className="shadow-premium"
              >
                Entrar
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-8"
            style={{
              backgroundColor:
                "color-mix(in oklch, var(--primary) 8%, transparent)",
            }}
          >
            <Zap className="h-3.5 w-3.5" />
            Plataforma de e-mail marketing multi-tenant
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            Planeje campanhas.
            <br />
            <span className="text-primary">Entenda cada resultado.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            MailFlow reúne contatos, campanhas, automações e métricas em uma
            plataforma independente, com autenticação local e agendamento
            integrado ao servidor.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              size="lg"
              className="shadow-premium-lg text-base h-12 px-8"
              onClick={() =>
                (window.location.href = isAuthenticated ? "/app" : "/login")
              }
            >
              Começar agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Hero visual */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl" />
            <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 p-8 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-3 sm:gap-6">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-primary">Campanhas</p>
                  <p className="text-sm text-muted-foreground">
                    Criação e agendamento
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-primary">Teste A/B</p>
                  <p className="text-sm text-muted-foreground">
                    Compare variantes
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-primary">Métricas</p>
                  <p className="text-sm text-muted-foreground">
                    Aberturas e cliques
                  </p>
                </div>
              </div>
              <p className="mt-8 text-xs text-muted-foreground">
                Explore os recursos com a base de demonstração local.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Tudo que sua empresa precisa
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma unificada com todas as ferramentas para criar,
              enviar e analisar campanhas de e-mail marketing.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: "Gestão de Contatos",
                desc: "Importe listas via CSV, crie campos customizados, segmente por comportamento e gerencie inscrições.",
              },
              {
                icon: Send,
                title: "Campanhas em Massa",
                desc: "Crie campanhas com editor rico, selecione listas ou segmentos e agende envios para milhões de contatos.",
              },
              {
                icon: Workflow,
                title: "Automações",
                desc: "Fluxos automatizados com gatilhos: inscrição em lista, abertura de e-mail, clique em link ou data específica.",
              },
              {
                icon: BarChart3,
                title: "Métricas Detalhadas",
                desc: "Acompanhe taxa de abertura, cliques, bounces, descadastros e histórico completo por campanha.",
              },
              {
                icon: Globe,
                title: "Domínios Próprios",
                desc: "Configure domínios personalizados com instruções de DNS (SPF, DKIM, DMARC) diretamente na interface.",
              },
              {
                icon: Shield,
                title: "Multi-tenant Seguro",
                desc: "Múltiplos usuários por organização com controle de permissões (admin/membro) e provedores SMTP próprios.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl p-6 border border-border/50 shadow-premium hover:shadow-premium-lg transition-all duration-200"
              >
                <div
                  className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4"
                  style={{
                    backgroundColor:
                      "color-mix(in oklch, var(--primary) 10%, transparent)",
                  }}
                >
                  <f.icon className="h-5.5 w-5.5 text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Pronto para escalar suas campanhas?
          </h2>
          <p className="text-muted-foreground mb-8">
            Explore os recursos do MailFlow com uma conta de demonstração local.
          </p>
          <Button
            size="lg"
            className="shadow-premium-lg text-base h-12 px-8"
            onClick={() =>
              (window.location.href = isAuthenticated ? "/app" : "/login")
            }
          >
            Acessar plataforma
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Mail className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">MailFlow</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 Jessica Baptista · MailFlow
          </p>
        </div>
      </footer>
    </div>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Newspaper, Tag, HandHeart, Megaphone } from "lucide-react";
import type { EmailBlock } from "./EmailBuilder";

/**
 * Pre-built block layouts for the visual email builder.
 * Each template is a factory returning fresh block IDs so instances
 * can be edited independently.
 */

let seq = 0;
function bid(): string {
  seq += 1;
  return `tpl-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}

export type GalleryTemplate = {
  key: string;
  name: string;
  description: string;
  icon: typeof Newspaper;
  accent: string;
  build: () => EmailBlock[];
};

export const galleryTemplates: GalleryTemplate[] = [
  {
    key: "newsletter",
    name: "Newsletter",
    description: "Boletim informativo com seções de destaque e artigos",
    icon: Newspaper,
    accent: "#4f46e5",
    build: () => [
      { id: bid(), type: "heading", content: "Novidades deste mês", align: "left" },
      { id: bid(), type: "text", content: "Olá! Preparamos um resumo do que aconteceu de mais importante. Continue lendo para não perder nada.", align: "left", fontSize: 15 },
      { id: bid(), type: "divider", color: "#e2e8f0" },
      { id: bid(), type: "image", src: "https://placehold.co/600x240/eef2ff/4f46e5?text=Destaque+do+m%C3%AAs", alt: "Destaque do mês", width: 100 },
      { id: bid(), type: "heading", content: "Destaque principal", align: "left" },
      { id: bid(), type: "text", content: "Descreva aqui a notícia ou atualização mais relevante do período. Mantenha o texto curto e direto, incentivando o leitor a clicar para saber mais.", align: "left", fontSize: 15 },
      { id: bid(), type: "button", label: "Ler artigo completo", url: "https://exemplo.com/artigo", bgColor: "#4f46e5", textColor: "#ffffff", align: "left" },
      { id: bid(), type: "spacer", height: 24 },
      { id: bid(), type: "divider", color: "#e2e8f0" },
      { id: bid(), type: "heading", content: "Outras notícias", align: "left" },
      { id: bid(), type: "text", content: "• Primeira atualização breve com link\n• Segunda atualização breve com link\n• Terceira atualização breve com link", align: "left", fontSize: 14 },
      { id: bid(), type: "spacer", height: 16 },
      { id: bid(), type: "text", content: "Até a próxima edição!\nEquipe da Sua Empresa", align: "left", fontSize: 14 },
    ],
  },
  {
    key: "promo",
    name: "Promoção",
    description: "E-mail promocional com oferta em destaque e CTA forte",
    icon: Tag,
    accent: "#dc2626",
    build: () => [
      { id: bid(), type: "image", src: "https://placehold.co/600x280/fef2f2/dc2626?text=Oferta+Especial", alt: "Oferta especial", width: 100 },
      { id: bid(), type: "heading", content: "Só esta semana: 20% de desconto", align: "center" },
      { id: bid(), type: "text", content: "Aproveite nossa oferta exclusiva para assinantes. Use o cupom abaixo antes que expire.", align: "center", fontSize: 15 },
      { id: bid(), type: "spacer", height: 12 },
      { id: bid(), type: "heading", content: "CUPOM20", align: "center" },
      { id: bid(), type: "spacer", height: 12 },
      { id: bid(), type: "button", label: "Aproveitar oferta", url: "https://exemplo.com/oferta", bgColor: "#dc2626", textColor: "#ffffff", align: "center" },
      { id: bid(), type: "spacer", height: 20 },
      { id: bid(), type: "divider", color: "#fecaca" },
      { id: bid(), type: "text", content: "Oferta válida até o fim da semana ou enquanto durarem os estoques. Consulte condições no site.", align: "center", fontSize: 12 },
    ],
  },
  {
    key: "welcome",
    name: "Boas-vindas",
    description: "Mensagem de boas-vindas para novos inscritos",
    icon: HandHeart,
    accent: "#059669",
    build: () => [
      { id: bid(), type: "heading", content: "Que bom ter você aqui! 👋", align: "center" },
      { id: bid(), type: "text", content: "Obrigado por se inscrever. A partir de agora você receberá nossas novidades, dicas e ofertas exclusivas diretamente na sua caixa de entrada.", align: "center", fontSize: 15 },
      { id: bid(), type: "spacer", height: 16 },
      { id: bid(), type: "image", src: "https://placehold.co/600x220/ecfdf5/059669?text=Bem-vindo(a)!", alt: "Boas-vindas", width: 100 },
      { id: bid(), type: "spacer", height: 16 },
      { id: bid(), type: "heading", content: "Por onde começar", align: "left" },
      { id: bid(), type: "text", content: "1. Explore nossos conteúdos mais populares\n2. Complete seu perfil para receber recomendações personalizadas\n3. Siga-nos nas redes sociais", align: "left", fontSize: 14 },
      { id: bid(), type: "button", label: "Começar agora", url: "https://exemplo.com/comecar", bgColor: "#059669", textColor: "#ffffff", align: "center" },
      { id: bid(), type: "spacer", height: 16 },
      { id: bid(), type: "text", content: "Alguma dúvida? Basta responder este e-mail — leremos com atenção.", align: "center", fontSize: 13 },
    ],
  },
  {
    key: "announcement",
    name: "Anúncio",
    description: "Comunicado de lançamento ou novidade importante",
    icon: Megaphone,
    accent: "#7c3aed",
    build: () => [
      { id: bid(), type: "heading", content: "Grande novidade chegando", align: "center" },
      { id: bid(), type: "text", content: "Temos o prazer de anunciar algo que vai transformar a sua experiência.", align: "center", fontSize: 15 },
      { id: bid(), type: "spacer", height: 12 },
      { id: bid(), type: "image", src: "https://placehold.co/600x300/f5f3ff/7c3aed?text=Lan%C3%A7amento", alt: "Lançamento", width: 100 },
      { id: bid(), type: "spacer", height: 12 },
      { id: bid(), type: "heading", content: "O que muda para você", align: "left" },
      { id: bid(), type: "text", content: "Explique aqui os principais benefícios da novidade em poucas linhas. Foque no valor para o leitor, não nas características técnicas.", align: "left", fontSize: 15 },
      { id: bid(), type: "divider", color: "#ede9fe" },
      { id: bid(), type: "text", content: "Disponível a partir de [data]. Seja um dos primeiros a experimentar.", align: "left", fontSize: 14 },
      { id: bid(), type: "button", label: "Conhecer agora", url: "https://exemplo.com/lancamento", bgColor: "#7c3aed", textColor: "#ffffff", align: "center" },
    ],
  },
];

/**
 * Mini visual preview of a template rendered from its block structure.
 */
function TemplateThumb({ template }: { template: GalleryTemplate }) {
  const blocks = template.build();
  return (
    <div className="bg-white rounded-lg border border-border/60 p-3 h-36 overflow-hidden relative">
      <div className="space-y-1.5 scale-[0.85] origin-top-left w-[118%]">
        {blocks.slice(0, 7).map(b => {
          switch (b.type) {
            case "heading":
              return <div key={b.id} className="h-2.5 rounded-sm bg-gray-800" style={{ width: "70%", marginLeft: b.align === "center" ? "15%" : 0 }} />;
            case "text":
              return (
                <div key={b.id} className="space-y-1">
                  <div className="h-1.5 rounded-sm bg-gray-300" style={{ width: "95%" }} />
                  <div className="h-1.5 rounded-sm bg-gray-300" style={{ width: "80%" }} />
                </div>
              );
            case "image":
              return <div key={b.id} className="h-8 rounded-sm" style={{ backgroundColor: `${template.accent}18` }} />;
            case "button":
              return <div key={b.id} className="h-3.5 w-20 rounded-sm" style={{ backgroundColor: template.accent, marginLeft: b.align === "center" ? "30%" : 0 }} />;
            case "divider":
              return <div key={b.id} className="h-px bg-gray-200" />;
            case "spacer":
              return <div key={b.id} className="h-1.5" />;
          }
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

export function TemplateGalleryDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (blocks: EmailBlock[], templateName: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Galeria de templates</DialogTitle>
          <DialogDescription>
            Comece com um layout pré-montado e personalize os blocos como quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2 max-h-[65vh] overflow-y-auto">
          {galleryTemplates.map(t => (
            <button
              key={t.key}
              onClick={() => { onApply(t.build(), t.name); onOpenChange(false); }}
              className="text-left rounded-xl border border-border/60 p-4 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <TemplateThumb template={t} />
              <div className="flex items-center gap-2.5 mt-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${t.accent}15` }}>
                  <t.icon className="h-4 w-4" style={{ color: t.accent }} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

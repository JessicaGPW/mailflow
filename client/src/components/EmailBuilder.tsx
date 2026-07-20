import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Type, Heading1, Image as ImageIcon, MousePointerClick, Minus, MoveVertical,
  Trash2, ChevronUp, ChevronDown, GripVertical, Monitor, Code
} from "lucide-react";
import { useState, useCallback } from "react";

// ─────────────────────────────────────────────
// Tipos de blocos
// ─────────────────────────────────────────────
export type EmailBlock =
  | { id: string; type: "heading"; content: string; align: "left" | "center" | "right" }
  | { id: string; type: "text"; content: string; align: "left" | "center" | "right"; fontSize: number }
  | { id: string; type: "image"; src: string; alt: string; width: number }
  | { id: string; type: "button"; label: string; url: string; bgColor: string; textColor: string; align: "left" | "center" | "right" }
  | { id: string; type: "divider"; color: string }
  | { id: string; type: "spacer"; height: number };

const blockPalette = [
  { type: "heading" as const, label: "Título", icon: Heading1 },
  { type: "text" as const, label: "Texto", icon: Type },
  { type: "image" as const, label: "Imagem", icon: ImageIcon },
  { type: "button" as const, label: "Botão", icon: MousePointerClick },
  { type: "divider" as const, label: "Divisor", icon: Minus },
  { type: "spacer" as const, label: "Espaço", icon: MoveVertical },
];

function newBlock(type: EmailBlock["type"]): EmailBlock {
  const id = Math.random().toString(36).slice(2, 10);
  switch (type) {
    case "heading": return { id, type, content: "Seu título aqui", align: "left" };
    case "text": return { id, type, content: "Escreva seu texto aqui. Você pode editar este bloco no painel à direita.", align: "left", fontSize: 15 };
    case "image": return { id, type, src: "https://placehold.co/600x240/e2e8f0/64748b?text=Imagem", alt: "Imagem", width: 100 };
    case "button": return { id, type, label: "Clique aqui", url: "https://exemplo.com", bgColor: "#4f46e5", textColor: "#ffffff", align: "center" };
    case "divider": return { id, type, color: "#e2e8f0" };
    case "spacer": return { id, type, height: 24 };
  }
}

// ─────────────────────────────────────────────
// Compilar blocos para HTML de e-mail (tabelas + inline styles)
// ─────────────────────────────────────────────
export function compileToEmailHtml(blocks: EmailBlock[]): string {
  const rows = blocks.map(b => {
    switch (b.type) {
      case "heading":
        return `<tr><td style="padding:12px 32px;text-align:${b.align};"><h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:#111827;line-height:1.3;">${b.content}</h2></td></tr>`;
      case "text":
        return `<tr><td style="padding:8px 32px;text-align:${b.align};"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:${b.fontSize}px;color:#374151;line-height:1.6;">${b.content.replace(/\n/g, "<br/>")}</p></td></tr>`;
      case "image":
        return `<tr><td style="padding:8px 32px;text-align:center;"><img src="${b.src}" alt="${b.alt}" width="${Math.round(536 * b.width / 100)}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;"/></td></tr>`;
      case "button":
        return `<tr><td style="padding:16px 32px;text-align:${b.align};"><a href="${b.url}" target="_blank" style="display:inline-block;padding:12px 32px;background-color:${b.bgColor};color:${b.textColor};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">${b.label}</a></td></tr>`;
      case "divider":
        return `<tr><td style="padding:16px 32px;"><hr style="border:none;border-top:1px solid ${b.color};margin:0;"/></td></tr>`;
      case "spacer":
        return `<tr><td style="height:${b.height}px;line-height:${b.height}px;font-size:1px;">&nbsp;</td></tr>`;
    }
  }).join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="height:24px;line-height:24px;font-size:1px;">&nbsp;</td></tr>
${rows}
<tr><td style="height:24px;line-height:24px;font-size:1px;">&nbsp;</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function compileToPlainText(blocks: EmailBlock[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case "heading": return b.content.toUpperCase();
      case "text": return b.content;
      case "image": return `[Imagem: ${b.alt}]`;
      case "button": return `${b.label}: ${b.url}`;
      case "divider": return "------------------------------";
      case "spacer": return "";
    }
  }).filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────
// Preview de um bloco no canvas
// ─────────────────────────────────────────────
function BlockPreview({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-2xl font-bold text-gray-900" style={{ textAlign: block.align }}>{block.content}</h2>;
    case "text":
      return <p className="text-gray-600 leading-relaxed whitespace-pre-wrap" style={{ textAlign: block.align, fontSize: block.fontSize }}>{block.content}</p>;
    case "image":
      return <div className="text-center"><img src={block.src} alt={block.alt} style={{ width: `${block.width}%` }} className="inline-block rounded-lg max-w-full" /></div>;
    case "button":
      return (
        <div style={{ textAlign: block.align }}>
          <span className="inline-block px-8 py-3 rounded-lg font-semibold text-sm" style={{ backgroundColor: block.bgColor, color: block.textColor }}>
            {block.label}
          </span>
        </div>
      );
    case "divider":
      return <hr style={{ borderColor: block.color }} />;
    case "spacer":
      return <div style={{ height: block.height }} className="flex items-center justify-center"><span className="text-[10px] text-muted-foreground/40">{block.height}px</span></div>;
  }
}

// ─────────────────────────────────────────────
// Painel de propriedades do bloco selecionado
// ─────────────────────────────────────────────
function BlockProperties({ block, onChange }: { block: EmailBlock; onChange: (b: EmailBlock) => void }) {
  const alignOptions = (
    <div className="space-y-1.5">
      <Label className="text-xs">Alinhamento</Label>
      <div className="flex gap-1">
        {(["left", "center", "right"] as const).map(a => (
          <button
            key={a}
            onClick={() => onChange({ ...block, align: a } as EmailBlock)}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs border transition-colors ${
              (block as any).align === a ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"
            }`}
          >
            {a === "left" ? "Esq." : a === "center" ? "Centro" : "Dir."}
          </button>
        ))}
      </div>
    </div>
  );

  switch (block.type) {
    case "heading":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Texto do título</Label>
            <Textarea rows={2} value={block.content} onChange={e => onChange({ ...block, content: e.target.value })} />
          </div>
          {alignOptions}
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Texto</Label>
            <Textarea rows={5} value={block.content} onChange={e => onChange({ ...block, content: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho da fonte: {block.fontSize}px</Label>
            <input type="range" min={11} max={24} value={block.fontSize} onChange={e => onChange({ ...block, fontSize: parseInt(e.target.value) })} className="w-full" />
          </div>
          {alignOptions}
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">URL da imagem</Label>
            <Input value={block.src} onChange={e => onChange({ ...block, src: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto alternativo</Label>
            <Input value={block.alt} onChange={e => onChange({ ...block, alt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Largura: {block.width}%</Label>
            <input type="range" min={20} max={100} value={block.width} onChange={e => onChange({ ...block, width: parseInt(e.target.value) })} className="w-full" />
          </div>
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Texto do botão</Label>
            <Input value={block.label} onChange={e => onChange({ ...block, label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL de destino</Label>
            <Input value={block.url} onChange={e => onChange({ ...block, url: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Cor de fundo</Label>
              <input type="color" value={block.bgColor} onChange={e => onChange({ ...block, bgColor: e.target.value })} className="w-full h-9 rounded-md border border-input cursor-pointer" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor do texto</Label>
              <input type="color" value={block.textColor} onChange={e => onChange({ ...block, textColor: e.target.value })} className="w-full h-9 rounded-md border border-input cursor-pointer" />
            </div>
          </div>
          {alignOptions}
        </div>
      );
    case "divider":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">Cor da linha</Label>
          <input type="color" value={block.color} onChange={e => onChange({ ...block, color: e.target.value })} className="w-full h-9 rounded-md border border-input cursor-pointer" />
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">Altura: {block.height}px</Label>
          <input type="range" min={8} max={96} step={4} value={block.height} onChange={e => onChange({ ...block, height: parseInt(e.target.value) })} className="w-full" />
        </div>
      );
  }
}

// ─────────────────────────────────────────────
// Builder principal
// ─────────────────────────────────────────────
export function EmailBuilder({
  blocks,
  onChange,
}: {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [paletteDragType, setPaletteDragType] = useState<EmailBlock["type"] | null>(null);

  const selected = blocks.find(b => b.id === selectedId) || null;

  const addBlock = useCallback((type: EmailBlock["type"], atIndex?: number) => {
    const b = newBlock(type);
    const next = [...blocks];
    if (atIndex !== undefined) next.splice(atIndex, 0, b);
    else next.push(b);
    onChange(next);
    setSelectedId(b.id);
  }, [blocks, onChange]);

  const updateBlock = useCallback((updated: EmailBlock) => {
    onChange(blocks.map(b => b.id === updated.id ? updated : b));
  }, [blocks, onChange]);

  const removeBlock = useCallback((id: string) => {
    onChange(blocks.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [blocks, onChange, selectedId]);

  const moveBlock = useCallback((from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }, [blocks, onChange]);

  const handleDropOnCanvas = useCallback((targetIndex: number) => {
    if (paletteDragType) {
      addBlock(paletteDragType, targetIndex);
      setPaletteDragType(null);
    } else if (dragIndex !== null && dragIndex !== targetIndex) {
      const adjusted = targetIndex > dragIndex ? targetIndex - 1 : targetIndex;
      moveBlock(dragIndex, adjusted);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [paletteDragType, dragIndex, addBlock, moveBlock]);

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Paleta de blocos */}
      <div className="col-span-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Blocos</p>
        <div className="space-y-1.5">
          {blockPalette.map(p => (
            <div
              key={p.type}
              draggable
              onDragStart={() => setPaletteDragType(p.type)}
              onDragEnd={() => setPaletteDragType(null)}
              onClick={() => addBlock(p.type)}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card cursor-grab hover:border-primary/40 hover:shadow-sm transition-all active:cursor-grabbing"
            >
              <p.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-medium">{p.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">Arraste blocos para o canvas ou clique para adicionar ao final.</p>
      </div>

      {/* Canvas */}
      <div className="col-span-7">
        <div className="bg-gray-100 rounded-xl p-6 min-h-[480px]">
          <div className="bg-white rounded-xl shadow-sm max-w-[600px] mx-auto overflow-hidden">
            {blocks.length === 0 ? (
              <div
                className="py-20 text-center text-muted-foreground text-sm"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDropOnCanvas(0)}
              >
                <Monitor className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                Arraste blocos aqui para montar seu e-mail
              </div>
            ) : (
              <div className="py-4">
                {blocks.map((block, i) => (
                  <div key={block.id}>
                    {/* Drop zone acima */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOverIndex(i); }}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={() => handleDropOnCanvas(i)}
                      className={`h-2 mx-4 rounded transition-all ${dragOverIndex === i ? "h-10 bg-primary/10 border-2 border-dashed border-primary/40" : ""}`}
                    />
                    <div
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      onClick={() => setSelectedId(block.id)}
                      className={`group relative px-8 py-2 cursor-pointer transition-all ${
                        selectedId === block.id ? "ring-2 ring-primary ring-inset bg-primary/[0.02]" : "hover:bg-muted/30"
                      } ${dragIndex === i ? "opacity-40" : ""}`}
                    >
                      <BlockPreview block={block} />
                      {/* Controles do bloco */}
                      <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 transition-opacity ${
                        selectedId === block.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}>
                        <button onClick={e => { e.stopPropagation(); moveBlock(i, i - 1); }} className="p-1 rounded bg-card border border-border/60 shadow-sm hover:text-primary"><ChevronUp className="h-3 w-3" /></button>
                        <button onClick={e => { e.stopPropagation(); moveBlock(i, i + 1); }} className="p-1 rounded bg-card border border-border/60 shadow-sm hover:text-primary"><ChevronDown className="h-3 w-3" /></button>
                        <button onClick={e => { e.stopPropagation(); removeBlock(block.id); }} className="p-1 rounded bg-card border border-border/60 shadow-sm hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                      <div className={`absolute left-2 top-1/2 -translate-y-1/2 transition-opacity ${selectedId === block.id ? "opacity-60" : "opacity-0 group-hover:opacity-40"}`}>
                        <GripVertical className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                ))}
                {/* Drop zone final */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverIndex(blocks.length); }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => handleDropOnCanvas(blocks.length)}
                  className={`h-4 mx-4 rounded transition-all ${dragOverIndex === blocks.length ? "h-10 bg-primary/10 border-2 border-dashed border-primary/40" : ""}`}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Painel de propriedades */}
      <div className="col-span-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Propriedades</p>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          {selected ? (
            <BlockProperties block={selected} onChange={updateBlock} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Selecione um bloco no canvas para editar suas propriedades.</p>
          )}
        </div>
      </div>
    </div>
  );
}

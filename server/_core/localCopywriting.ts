export type SubjectTone = "professional" | "friendly" | "urgent" | "curious";
export type ContentGoal = "clarity" | "engagement" | "conversion" | "shorten";

export function suggestSubjects(
  topic: string,
  audience?: string,
  tone: SubjectTone = "professional",
) {
  const cleanTopic = topic.trim().replace(/[.!?]+$/g, "");
  const cleanAudience = audience?.trim();
  const context = cleanAudience ? ` para ${cleanAudience}` : "";
  const suggestions = [
    {
      subject: `${cleanTopic}: veja o que mudou`,
      preheader: `Uma novidade preparada${context}.`,
      rationale: "Apresenta o tema de forma direta e específica.",
    },
    {
      subject: `Uma novidade sobre ${cleanTopic}`,
      preheader: "Confira os detalhes e veja se faz sentido para você.",
      rationale: "Usa um tom próximo sem exagerar na promessa.",
    },
    {
      subject: `${cleanTopic} em poucos minutos`,
      preheader: "Veja os principais pontos nesta mensagem.",
      rationale: "Destaca que a leitura é rápida e objetiva.",
    },
    {
      subject: `O que você precisa saber sobre ${cleanTopic}`,
      preheader: `Informações úteis${context}, sem rodeios.`,
      rationale: "Explica com clareza o benefício de abrir o e-mail.",
    },
    {
      subject: `Vale a pena conhecer ${cleanTopic}?`,
      preheader: "Veja os detalhes e tire suas próprias conclusões.",
      rationale: "Abre uma pergunta relevante sem usar clickbait.",
    },
  ];

  if (tone === "friendly") {
    suggestions[0]!.subject = `Tem novidade: ${cleanTopic}`;
  } else if (tone === "urgent") {
    suggestions[0]!.subject = `Atenção: ${cleanTopic}`;
    suggestions[0]!.rationale = "Cria destaque sem alegar uma urgência falsa.";
  } else if (tone === "curious") {
    suggestions[0]!.subject = `Descubra ${cleanTopic}`;
  }

  return {
    suggestions: suggestions.map(suggestion => ({
      ...suggestion,
      subject: suggestion.subject.slice(0, 50),
    })),
  };
}

const textReplacements: Record<ContentGoal, Array<[RegExp, string]>> = {
  clarity: [
    [/\bem virtude do fato de que\b/gi, "porque"],
    [/\bcom o objetivo de\b/gi, "para"],
    [/\bno presente momento\b/gi, "agora"],
    [/\brealizar a\b/gi, "fazer a"],
  ],
  engagement: [
    [/\bprezado cliente\b/gi, "Olá"],
    [/\bprezados clientes\b/gi, "Olá"],
    [/\bvenho por meio deste\b/gi, "Escrevo para"],
  ],
  conversion: [
    [/\bclique aqui\b/gi, "saiba mais"],
    [/\bmais informações\b/gi, "ver os detalhes"],
  ],
  shorten: [
    [/\b(basicamente|realmente|na verdade|de fato)\b[,\s]*/gi, ""],
    [/\b(completamente|totalmente)\b[,\s]*/gi, ""],
    [/\s{2,}/g, " "],
  ],
};

export function optimizeContent(content: string, goal: ContentGoal, isHtml = false) {
  const replacements = textReplacements[goal];
  let changed = false;
  const optimized = content
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) return part;
      let result = part;
      for (const [pattern, replacement] of replacements) {
        result = result.replace(pattern, replacement);
      }
      if (!isHtml) result = result.replace(/[ \t]+([,.;!?])/g, "$1");
      if (result !== part) changed = true;
      return result;
    })
    .join("");

  const goalLabels: Record<ContentGoal, string> = {
    clarity: "simplifiquei algumas expressões para facilitar a leitura",
    engagement: "troquei saudações formais por uma linguagem mais próxima",
    conversion: "substituí chamadas genéricas por instruções mais claras",
    shorten: "removi palavras dispensáveis e espaços repetidos",
  };

  return {
    optimized,
    changes: changed
      ? [goalLabels[goal]]
      : ["O texto já está conciso para esta regra; nenhuma alteração automática foi necessária."],
  };
}

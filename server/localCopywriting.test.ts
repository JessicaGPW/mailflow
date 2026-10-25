import { describe, expect, it } from "vitest";
import { optimizeContent, suggestSubjects } from "./_core/localCopywriting";

describe("local copywriting", () => {
  it("generates five subject options with the requested tone and no external model", () => {
    const result = suggestSubjects("Lançamento do novo plano", "pessoas empreendedoras", "curious");

    expect(result.suggestions).toHaveLength(5);
    expect(result.suggestions[0]?.subject).toBe("Descubra Lançamento do novo plano");
    expect(result.suggestions.every(suggestion => suggestion.subject.length <= 50)).toBe(true);
    expect(result.suggestions.every(suggestion => suggestion.preheader.length > 0)).toBe(true);
  });

  it("applies the selected local text rule", () => {
    const result = optimizeContent(
      "Com o objetivo de melhorar, vamos realizar a mudança.",
      "clarity",
    );

    expect(result.optimized).toBe("para melhorar, vamos fazer a mudança.");
    expect(result.changes).toHaveLength(1);
  });

  it("only changes visible text and preserves HTML tags", () => {
    const result = optimizeContent(
      "<p>Prezado cliente, clique aqui.</p>",
      "engagement",
      true,
    );

    expect(result.optimized).toBe("<p>Olá, clique aqui.</p>");
    expect(result.optimized.match(/<[^>]+>/g)).toEqual(["<p>", "</p>"]);
  });
});

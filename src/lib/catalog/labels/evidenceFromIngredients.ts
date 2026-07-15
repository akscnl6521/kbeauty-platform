/** Exact-match evidence slugs for curated/full INCI tokens. */
const EVIDENCE_MAP: Record<string, string> = {
  panthenol: "panthenol",
  "centella asiatica": "centella-asiatica",
  niacinamide: "niacinamide",
  "sodium hyaluronate": "hyaluronic-acid",
  "salicylic acid": "salicylic-acid",
  "betaine salicylate": "salicylic-acid",
  retinol: "retinol",
  "ascorbic acid": "ascorbic-acid",
  "3-o-ethyl ascorbic acid": "ascorbic-acid",
  "zinc oxide": "zinc-oxide",
  "zinc pca": "zinc-oxide",
  "snail secretion filtrate": "snail-mucin",
};

export function evidenceSlugsFromIngredients(ingredients: string[]): string[] {
  const out = new Set<string>();
  for (const ing of ingredients) {
    const key = ing
      .trim()
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\d+(\.\d+)?%\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const mapped = EVIDENCE_MAP[key];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

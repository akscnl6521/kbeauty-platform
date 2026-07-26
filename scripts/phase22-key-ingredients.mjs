import fs from "node:fs";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients";
import pools from "../data/catalog/scenario-pilot-enrichment-de/2026-07-22/scenario-pools.json";

const p = JSON.parse(
  fs.readFileSync(
    "data/catalog/scenario-pilot-enrichment-de/2026-07-22/products.json",
    "utf8"
  )
);

const slugs = [
  "aestura-atobarrier365-cream",
  "round-lab-dokdo-cream",
  "torriden-dive-in-serum",
  "skin1004-madagascar-centella-ampoule",
  "beauty-of-joseon-green-plum-refreshing-toner",
  "haruharu-wonder-black-rice-hyaluronic-toner",
];

for (const slug of slugs) {
  const it = p.products.find((x) => x.externalProductId === slug);
  const parsed = parseIngredientList(it.ingredientsRaw);
  const keys = extractKeyIngredientsFromFullList(
    parsed.normalized.map((t) => ({
      token: t.token,
      normalizedName: t.normalizedName,
      order: t.order,
    }))
  );
  console.log(slug, "->", keys.map((k) => k.tokenFromList).join(" | ") || "(none)");
}

for (const id of [
  "kr-redness-sensitive-cream",
  "pilot-dryness-barrier-serum",
  "kr-acne-pores-toner",
]) {
  const slots = pools[id].slots.filter((s) => s.readiness === "recommendation_ready");
  console.log("\n" + id, "ready", slots.length);
  for (const s of slots) console.log(" -", s.productId, s.role || "");
}

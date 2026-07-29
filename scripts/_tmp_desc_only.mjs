import { readFileSync } from "node:fs";
const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0)";
const art = JSON.parse(readFileSync("artifacts/tier1-collect/shopify-2026-07-28.json", "utf8"));

const { extractLabeledIngredientsRaw } = await import(
  "../src/lib/catalog/enrichment/extractLabeledIngredients.ts"
);

const targets = art.results.filter((r) => r.purchaseUrl);
let fromDesc = 0;
let fromPage = 0;
const rows = [];

for (const t of targets) {
  const u = new URL(t.purchaseUrl);
  const jsUrl = `${u.origin}${u.pathname}.js`;
  let desc = "";
  try {
    const r = await fetch(jsUrl, { headers: { "User-Agent": UA } });
    if (r.ok) desc = (await r.json()).description ?? "";
  } catch {}

  const d = desc ? extractLabeledIngredientsRaw(desc) : null;
  let p = null;
  if (!d) {
    try {
      const r = await fetch(t.purchaseUrl, { headers: { "User-Agent": UA } });
      if (r.ok) p = extractLabeledIngredientsRaw(await r.text());
    } catch {}
  }
  if (d) fromDesc += 1;
  else if (p) fromPage += 1;

  const chosen = d ?? p;
  rows.push({
    id: t.productId,
    name: t.name.slice(0, 32),
    src: d ? "description" : p ? "page" : "-",
    head: chosen ? chosen.raw.slice(0, 46).replace(/\s+/g, " ") : "",
  });
  await new Promise((r) => setTimeout(r, 350));
}

console.log(`description 에서 확보 ${fromDesc} · 페이지 폴백 ${fromPage} · 실패 ${targets.length - fromDesc - fromPage} / ${targets.length}`);
console.log("\nid   출처         첫머리");
for (const r of rows) console.log(`${String(r.id).padStart(4)} ${r.src.padEnd(12)} ${r.head}`);

/**
 * Build official INCI label sheet from COSRX seed CSV + Staging snail-96 snapshot.
 * Does not invent ingredients — copies existing verified sources only.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type {
  OfficialInciLabelEntry,
  OfficialInciLabelSheet,
} from "@/lib/catalog/labels";
import { validateOfficialInciLabelSheet } from "@/lib/catalog/labels";
import { parseOfficialIngredientsRaw } from "@/lib/catalog/automation/ingredientParser";

const root = process.cwd();

function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        q = false;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"') {
      q = true;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function tokensFromOfficialRaw(raw: string, sourceUrl: string): string[] {
  const parsed = parseOfficialIngredientsRaw({
    ingredientsRaw: raw,
    sourceUrl,
    sourceType: "official_brand_page",
    sourceTier: 1,
    sourceVerified: true,
  });
  return parsed.tokens.map((t) => t.inciName || t.ingredientRaw);
}

function main() {
  const csvPath = path.join(
    root,
    "data/catalog-import/2026-07-cosrx-seed/products.csv"
  );
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const header = rows[0]!;
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const entries: OfficialInciLabelEntry[] = [];

  entries.push({
    externalProductId: "cosrx-advanced-snail-96-mucin-power-essence",
    brandCanonical: "COSRX",
    productNameEn: "Advanced Snail 96 Mucin Power Essence",
    sourceType: "staging_products_verified",
    sourceUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    labelCheckedAt: "2026-07-15",
    labelLanguage: "en",
    fullIngredientsRaw:
      "Water, Snail Secretion Filtrate, Betaine, Butylene Glycol, Niacinamide, Sodium Hyaluronate, Panthenol, Arginine, Allantoin, Glycerin, Sodium Polyacrylate, Copper Tripeptide-1, Caprylyl Glycol, Carbomer, Phenoxyethanol",
    fullIngredients: [
      "Water",
      "Snail Secretion Filtrate",
      "Betaine",
      "Butylene Glycol",
      "Niacinamide",
      "Sodium Hyaluronate",
      "Panthenol",
      "Arginine",
      "Allantoin",
      "Glycerin",
      "Sodium Polyacrylate",
      "Copper Tripeptide-1",
      "Caprylyl Glycol",
      "Carbomer",
      "Phenoxyethanol",
    ],
    notes:
      "Copied from Staging public.products slug (existing verified seed). Re-check packaging for formula changes.",
    applyReady: true,
  });

  for (const r of rows.slice(1)) {
    const slug = r[idx.slug!]!;
    const ings = r[idx.full_ingredients!]!;
    const sourceUrl = r[idx.source_url!]!;
    const tokens = tokensFromOfficialRaw(ings, sourceUrl);
    const needsReview =
      slug.includes("sunscreen") || slug.includes("propolis");
    entries.push({
      externalProductId: slug,
      brandCanonical: r[idx.brand!]!,
      productNameEn: r[idx.product_name!]!,
      sourceType: "official_brand_page",
      sourceUrl,
      labelCheckedAt: "2026-07-14",
      labelLanguage: "en",
      fullIngredientsRaw: ings,
      fullIngredients: tokens,
      notes:
        "From data/catalog-import/2026-07-cosrx-seed/products.csv (official COSRX.com listing). Tokens via parseOfficialIngredientsRaw.",
      applyReady: !needsReview && tokens.length >= 3,
    });
  }

  const sheet: OfficialInciLabelSheet = {
    _meta: {
      sheetVersion: 1,
      rule: "Only paste verbatim official label / official PDP INCI. Never invent.",
      sprintTagDefault: "full-beauty-20260714",
      builtAt: new Date().toISOString(),
      sourcesNote:
        "COSRX seed pack 2026-07 + Staging products snail-96 snapshot",
    },
    entries,
  };

  const v = validateOfficialInciLabelSheet(sheet);
  if (!v.ok) {
    console.error(v.issues);
    process.exit(1);
  }

  const outDirPath = path.join(root, "data/catalog/labels");
  mkdirSync(outDirPath, { recursive: true });
  const outPath = path.join(outDirPath, "official-inci-sheet.v1.json");
  writeFileSync(outPath, JSON.stringify(sheet, null, 2), "utf8");
  console.log(
    JSON.stringify({
      outPath,
      entries: entries.length,
      applyReady: v.applyableCount,
    })
  );
}

main();

/**
 * Concern differentiation selftest — evidence + guidance + ranking fingerprints.
 * Run: npx tsx scripts/evidence-concern-diff-selftest.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  applyEvidenceToRecommendation,
} from "@/lib/evidence/applyEvidenceToRecommendation";
import { loadStaticApprovedEvidenceForConcerns } from "@/lib/evidence/staticCatalog";
import { buildMatchReason } from "@/lib/recommend/buildMatchReason";
import { rankProducts } from "@/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "@/lib/recommend/types";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const CATALOG: RankableProduct[] = [
  {
    id: "1",
    name: "Niacinamide Serum",
    brand: "COSRX",
    key_ingredients: ["Niacinamide", "Zinc PCA"],
    skin_concern: ["acne", "pores", "pigmentation"],
  },
  {
    id: "2",
    name: "Retinol Cream",
    brand: "COSRX",
    key_ingredients: ["Retinol", "Adenosine", "Panthenol"],
    skin_concern: ["antiaging"],
  },
  {
    id: "3",
    name: "AHA BHA Toner",
    brand: "COSRX",
    key_ingredients: ["Salicylic Acid", "Glycolic Acid", "Panthenol"],
    skin_concern: ["pores", "acne"],
  },
  {
    id: "4",
    name: "Snail Mucin",
    brand: "COSRX",
    key_ingredients: ["Sodium Hyaluronate", "Panthenol"],
    skin_concern: ["dryness", "redness"],
  },
  {
    id: "5",
    name: "Mineral Sunscreen",
    brand: "COSRX",
    key_ingredients: ["Zinc Oxide", "Titanium Dioxide"],
    skin_concern: ["uv"],
  },
];

const LABELS: Array<{ label: string; code: string }> = [
  { label: "색소침착", code: "pigmentation" },
  { label: "주름", code: "antiaging" },
  { label: "모공", code: "pores" },
  { label: "자외선", code: "uv" },
  { label: "여드름", code: "acne" },
];

async function main() {
  loadEnvLocal();

  const fingerprints = new Map<string, string>();

  for (const { label, code } of LABELS) {
    const staticEv = loadStaticApprovedEvidenceForConcerns([label]);
    assert.ok(staticEv.length >= 1, `${label} static evidence`);
    assert.ok(
      staticEv.every((e) => e.concernCode === code),
      `${label} concernCode`
    );
    assert.ok(
      staticEv.every((e) => e.pmid || e.doi || e.sourceUrl),
      `${label} citation`
    );

    let rec: Recommendation = {
      skinConcerns: [label],
      recommendedIngredients: [],
      ingredientsToAvoid: [],
      confidenceScore: 0.7,
    };
    rec = applyEvidenceToRecommendation(rec, staticEv);
    assert.ok((rec.evidenceLinks?.length ?? 0) >= 1, `${label} links`);
    assert.ok((rec.precautions?.length ?? 0) >= 1, `${label} precautions`);
    assert.ok(
      (rec.recommendedIngredients?.length ?? 0) >= 1,
      `${label} ingredients`
    );

    const ranked = rankProducts(rec, CATALOG);
    assert.ok(ranked.length >= 1, `${label} ranked`);
    const top = ranked[0]!;
    const reason = buildMatchReason({
      recommendation: rec,
      matchedIngredients: top.matchedIngredients ?? [],
      product: top.product,
    });

    const fp = [
      code,
      [...new Set(staticEv.map((e) => e.ingredientSlug))].sort().join(","),
      [...new Set(staticEv.map((e) => e.pmid))].sort().join(","),
      (rec.precautions ?? []).slice(0, 1).join("|"),
      top.product.name,
      reason.slice(0, 80),
    ].join("||");

    fingerprints.set(label, fp);
    console.log(
      JSON.stringify({
        label,
        code,
        ingredients: rec.recommendedIngredients?.slice(0, 4),
        topProduct: top.product.name,
        matched: top.matchedIngredients?.slice(0, 3),
        pmidSample: staticEv.map((e) => e.pmid).slice(0, 2),
        precaution0: rec.precautions?.[0] ?? null,
      })
    );
  }

  const values = [...fingerprints.values()];
  const unique = new Set(values);
  assert.equal(
    unique.size,
    values.length,
    "each concern must produce a distinct evidence→product→reason fingerprint"
  );

  // acne must include salicylic reinforcement in static catalog
  const acne = loadStaticApprovedEvidenceForConcerns(["여드름"]);
  assert.ok(
    acne.some((e) => e.ingredientSlug === "salicylic-acid"),
    "acne salicylic reinforcement"
  );
  assert.ok(
    acne.some((e) => e.ingredientSlug === "niacinamide"),
    "acne keeps niacinamide"
  );

  const { resolveApprovedEvidenceForConcerns } = await import(
    "@/lib/evidence/loadApprovedEvidence"
  );
  const resolvedPig = await resolveApprovedEvidenceForConcerns(["색소침착"]);
  assert.ok(resolvedPig.length >= 1, "DB∪static pigmentation resolve");

  console.log(
    JSON.stringify({
      phase: "evidence_concern_diff_ok",
      concernsChecked: LABELS.map((l) => l.label),
      fingerprintCount: unique.size,
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

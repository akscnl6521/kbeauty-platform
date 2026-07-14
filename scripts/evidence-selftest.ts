/**
 * Evidence Layer selftest — run: node --import tsx scripts/evidence-selftest.ts
 * or: npx tsx scripts/evidence-selftest.ts (after env load below)
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  applyEvidenceToRecommendation,
  evidenceForMatchedIngredients,
} from "@/lib/evidence/applyEvidenceToRecommendation";
import { loadStaticApprovedEvidenceForConcerns } from "@/lib/evidence/staticCatalog";

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

async function main() {
  loadEnvLocal();

  const redness = loadStaticApprovedEvidenceForConcerns(["붉은기", "민감성"]);
  assert.ok(redness.length >= 2, "redness evidence rows");
  assert.ok(
    redness.every((e) => e.pmid || e.doi || e.sourceUrl),
    "citation present"
  );

  const acne = loadStaticApprovedEvidenceForConcerns(["여드름"]);
  assert.ok(
    acne.some((e) => e.ingredientSlug === "niacinamide"),
    "acne niacinamide"
  );

  const rec = applyEvidenceToRecommendation(
    {
      skinConcerns: ["붉은기", "건조함"],
      recommendedIngredients: ["센텔라 아시아티카"],
      ingredientsToAvoid: [],
      confidenceScore: 0.7,
    },
    redness
  );
  assert.ok((rec.evidenceLinks?.length ?? 0) > 0, "evidenceLinks attached");

  const hits = evidenceForMatchedIngredients(rec.evidenceLinks, ["Panthenol"]);
  assert.ok(hits.length >= 1, "matched evidence");

  const { resolveApprovedEvidenceForConcerns } = await import(
    "@/lib/evidence/loadApprovedEvidence"
  );
  const resolved = await resolveApprovedEvidenceForConcerns(["붉은기"]);
  assert.ok(resolved.length >= 1, "resolveApprovedEvidenceForConcerns");

  console.log(
    JSON.stringify({
      phase: "evidence_selftest_ok",
      rednessCount: redness.length,
      acneCount: acne.length,
      resolvedCount: resolved.length,
      matchedHits: hits.length,
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

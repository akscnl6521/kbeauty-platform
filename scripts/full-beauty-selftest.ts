/**
 * Full beauty / makeup / scalp rank selftests.
 * Run: npx tsx scripts/full-beauty-selftest.ts
 */
import assert from "node:assert/strict";
import {
  generateFullBeautyCatalog,
  processFullBeautyCatalog,
  KR_BRAND_SEED_REGISTRY,
} from "@/lib/catalog/bulkKr";
import {
  rankMascaraProducts,
  rankLipProducts,
  rankBaseMakeupByUndertone,
} from "@/lib/catalog/makeup";
import {
  rankScalpProducts,
  rankHairProducts,
} from "@/lib/catalog/scalpHair/rankScalpHair";
import { beautyDomainForCategory } from "@/lib/catalog/taxonomy/domains";

function main() {
  assert.ok(KR_BRAND_SEED_REGISTRY.length >= 30, "brands>=30");

  const { items, underTargetReason } = generateFullBeautyCatalog(1000);
  assert.ok(items.length >= 1000, `catalog>=1000 got ${items.length}`);
  assert.equal(underTargetReason, null);

  const domains = new Set(items.map((i) => i.domain));
  assert.ok(domains.has("face_skincare") || domains.has("sun_care"), "skincare");
  assert.ok(domains.has("lip_color") || domains.has("base_makeup") || domains.has("eye_makeup"), "makeup");
  assert.ok(domains.has("scalp_care") || domains.has("hair_care"), "hair");

  const { products, stats } = processFullBeautyCatalog(items);
  assert.equal(stats.total, items.length);
  assert.ok(stats.needsReview > 0, "needs_review present");
  assert.ok(stats.autoRegister > 0, "auto_register heroes");
  assert.ok(
    products.every((p) => p.disposition !== "auto_register" || p.curatedProvenance !== "category_discovery"),
    "discovery never auto"
  );

  // Makeup rank fingerprints
  const mascaraPool = [
    {
      id: "m1",
      category: "mascara",
      waterproof: true,
      mascaraEffects: ["curl", "volume", "longlash"],
    },
    {
      id: "m2",
      category: "mascara",
      waterproof: false,
      mascaraEffects: ["volume"],
    },
    { id: "serum", category: "serum", mascaraEffects: ["curl"] },
  ];
  const mCurl = rankMascaraProducts({ wantCurl: true, waterproof: true }, mascaraPool);
  const mVol = rankMascaraProducts({ wantVolume: true, waterproof: false }, mascaraPool);
  assert.ok(mCurl[0]?.product.id === "m1", "mascara curl/wp");
  assert.ok(mVol[0]?.product.id === "m2" || mVol[0]?.product.id === "m1", "mascara volume");
  assert.ok(!mCurl.some((r) => r.product.id === "serum"), "no cross domain mascara");

  const lipPool = [
    {
      id: "cool-matte",
      category: "lip_tint",
      undertoneFit: ["cool"],
      finish: "matte",
      lipEffects: ["stain", "matte"],
    },
    {
      id: "warm-gloss",
      category: "lip_tint",
      undertoneFit: ["warm"],
      finish: "glossy",
      lipEffects: ["gloss"],
    },
  ];
  const lipCool = rankLipProducts({ undertone: "cool", finish: "matte" }, lipPool);
  const lipWarm = rankLipProducts({ undertone: "warm", finish: "glossy", dryLips: true }, lipPool);
  assert.equal(lipCool[0]?.product.id, "cool-matte");
  assert.equal(lipWarm[0]?.product.id, "warm-gloss");
  assert.notEqual(lipCool[0]?.product.id, lipWarm[0]?.product.id);

  const basePool = [
    { id: "c-cool", category: "cushion", undertoneFit: ["cool"], coverage: "medium", finish: "natural" },
    { id: "c-warm", category: "cushion", undertoneFit: ["warm"], coverage: "medium", finish: "glow" },
  ];
  const baseCool = rankBaseMakeupByUndertone({ undertone: "cool", coverage: "medium" }, basePool);
  assert.equal(baseCool[0]?.product.id, "c-cool");

  // Scalp / shampoo
  const scalpPool = [
    {
      id: "sens",
      category: "sensitive_scalp_shampoo",
      scalpTypes: ["sensitive" as const],
      scalpConcerns: ["itching" as const],
    },
    {
      id: "oily",
      category: "oily_scalp_shampoo",
      scalpTypes: ["oily" as const],
      scalpConcerns: ["excess_oil" as const],
    },
  ];
  const sens = rankScalpProducts({ scalpType: "sensitive" }, scalpPool);
  const oily = rankScalpProducts({ scalpType: "oily" }, scalpPool);
  assert.ok(sens[0] && oily[0]);
  assert.notEqual(sens[0]!.product.id, oily[0]!.product.id);

  const hairPool = [
    {
      id: "dmg",
      category: "treatment",
      hairConcerns: ["damage" as const],
    },
    {
      id: "heat",
      category: "heat_protectant",
      hairConcerns: ["heat_damage" as const],
    },
  ];
  const dmg = rankHairProducts({ hairConcerns: ["damage"] }, hairPool);
  const heat = rankHairProducts({ hairConcerns: ["heat_damage"] }, hairPool);
  assert.ok(dmg[0] && heat[0]);
  assert.notEqual(dmg[0]!.product.id, heat[0]!.product.id);

  assert.equal(beautyDomainForCategory("mascara"), "eye_makeup");
  assert.equal(beautyDomainForCategory("lip_tint"), "lip_color");

  console.log(
    JSON.stringify({
      ok: true,
      brands: KR_BRAND_SEED_REGISTRY.length,
      products: stats.total,
      autoRegister: stats.autoRegister,
      needsReview: stats.needsReview,
      byDomain: stats.byDomain,
    })
  );
}

main();

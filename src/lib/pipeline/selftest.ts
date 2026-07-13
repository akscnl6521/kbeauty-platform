import { parseIngredientList } from "@/lib/pipeline/ingredient-normalize";
import {
  classifySkinMatch,
  computeQualityScore,
  scoreToneUndertone,
} from "@/lib/pipeline/scoring";
import { linkIngredientSafetyHints } from "@/lib/pipeline/evidence-link";
import type { ExtractedCatalogProduct } from "@/lib/pipeline/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function sampleProduct(
  overrides: Partial<ExtractedCatalogProduct> = {}
): ExtractedCatalogProduct {
  return {
    productName: "Hydrating Serum",
    brandName: "Example",
    canonicalUrl: "https://example.com/products/hydrating-serum",
    category: "serum",
    imageUrl: "https://example.com/a.jpg",
    description: "Hydrating serum with ceramides for dry skin",
    fullIngredientsText: "Water, Glycerin, Ceramide NP, Fragrance",
    keyIngredients: ["Ceramide NP"],
    sizeLabel: "30ml",
    priceReference: null,
    currency: null,
    availabilityReference: null,
    country: "KR",
    sourceType: "official_site",
    confidence: 0.8,
    extractionMethod: "selftest",
    fieldConfidence: { productName: 0.9 },
    ...overrides,
  };
}

/**
 * Pure-function self-tests (no network, no DB).
 */
export function runPipelineSelftests(): { ok: true; checks: number } {
  let checks = 0;

  const parsed = parseIngredientList("Water, Glycerin; Ceramide NP (and) Fragrance");
  assert(parsed.normalized.length >= 3, "ingredient parse count");
  checks += 1;

  const hints = linkIngredientSafetyHints(parsed.normalized.map((n) => n.normalizedName));
  assert(hints.some((h) => h.cautionTags.includes("fragrance")), "fragrance caution");
  checks += 1;

  const skin = classifySkinMatch(sampleProduct());
  assert(skin.skinTypes.includes("dry") || skin.concerns.includes("dehydration"), "skin dry");
  checks += 1;

  const toneSkincare = scoreToneUndertone(sampleProduct());
  assert(toneSkincare.toneRelevance === "not_applicable", "skincare tone n/a");
  checks += 1;

  const toneColor = scoreToneUndertone(
    sampleProduct({
      productName: "Warm Peach Lipstick",
      description: "warm golden undertone shade",
      category: "lipstick",
      fullIngredientsText: null,
    })
  );
  assert(toneColor.toneRelevance !== "not_applicable", "color tone relevant");
  checks += 1;

  const quality = computeQualityScore({
    product: sampleProduct(),
    hasIngredients: true,
    hasOfficialSource: true,
    dedupeOk: true,
    offerCount: 0,
  });
  assert(quality.publishEligible === false, "no auto publish");
  assert(quality.blockers.some((b) => /offer/i.test(b)), "offer blocker");
  checks += 1;

  return { ok: true, checks };
}

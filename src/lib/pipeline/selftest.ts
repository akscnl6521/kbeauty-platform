import { parseIngredientList } from "@/lib/pipeline/ingredient-normalize";
import {
  classifySkinMatch,
  computeQualityScore,
  scoreToneUndertone,
} from "@/lib/pipeline/scoring";
import { linkIngredientSafetyHints } from "@/lib/pipeline/evidence-link";
import { classifyHost, canAutoCrawl } from "@/lib/pipeline/domain-class";
import { evaluateCandidateCommitGate } from "@/lib/pipeline/quality-gate";
import {
  isPlaceholderBrand,
  looksLikeProductTitle,
  looksLikeProductUrl,
} from "@/lib/pipeline/product-page";
import {
  assertHardWritePolicy,
  DEFAULT_PIPELINE_OPERATION,
  validatePipelineOperationConfig,
} from "@/lib/pipeline/operation-config";
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

  const hints = linkIngredientSafetyHints(
    parsed.normalized.map((n) => n.normalizedName)
  );
  assert(
    hints.some((h) => h.cautionTags.includes("fragrance")),
    "fragrance caution"
  );
  checks += 1;

  const skin = classifySkinMatch(sampleProduct());
  assert(
    skin.skinTypes.includes("dry") || skin.concerns.includes("dehydration"),
    "skin dry"
  );
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

  assert(classifyHost("oliveyoung.co.kr") === "marketplace", "marketplace class");
  assert(classifyHost("instagram.com") === "social", "social class");
  assert(canAutoCrawl("verified_official", 0.9) === true, "crawl verified");
  assert(canAutoCrawl("marketplace", 0.9) === false, "no crawl marketplace");
  checks += 1;

  const gateFail = evaluateCandidateCommitGate({
    site: {
      brandKey: "x",
      canonicalName: "X",
      selectedUrl: "https://x.com",
      classification: "marketplace",
      confidence: 0.9,
      reasons: [],
      candidates: [],
      allowCrawl: false,
      connectorHint: null,
    },
    product: sampleProduct(),
    dedupe: {
      action: "create_candidate",
      score: 0.2,
      reasons: [],
      existingCandidateId: null,
      existingProductId: null,
    },
    quality,
    officialConfidence: 0.9,
  });
  assert(gateFail.pass === false, "marketplace gate fail");
  checks += 1;

  assert(
    looksLikeProductUrl("https://cosrx.co.kr/shop/shopdetail.html?branduid=1"),
    "shopdetail url"
  );
  assert(
    !looksLikeProductUrl("https://somebymi.co.kr/category/all/1"),
    "reject category url"
  );
  assert(!looksLikeProductTitle("전제품 - 전제품"), "reject category title");
  assert(isPlaceholderBrand("Unknown"), "unknown brand placeholder");
  checks += 1;

  const valid = validatePipelineOperationConfig(DEFAULT_PIPELINE_OPERATION);
  assert(valid.ok === true, "default config valid");
  if (valid.ok) {
    assertHardWritePolicy(valid.config);
    assert(valid.config.allowProductInsert === false, "no product insert");
    assert(valid.config.allowOfferInsert === false, "no offer insert");
    assert(valid.config.allowPublish === false, "no publish");
    assert(valid.config.allowDelete === false, "no delete");
  }
  const bad = validatePipelineOperationConfig({
    ...DEFAULT_PIPELINE_OPERATION,
    allowPublish: true,
  });
  assert(bad.ok === false, "reject allowPublish true");
  checks += 1;

  return { ok: true, checks };
}

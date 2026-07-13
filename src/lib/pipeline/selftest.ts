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
import { classifyProductCategory } from "@/lib/pipeline/category-classify";
import { attachIngredientMatches } from "@/lib/pipeline/ingredient-normalize";
import { classifyOfferSource } from "@/lib/pipeline/offers/offer-source-class";
import { parseOfferPrice } from "@/lib/pipeline/offers/offer-price";
import { parseStockStatus } from "@/lib/pipeline/offers/offer-stock";
import { matchOfferToProduct } from "@/lib/pipeline/offers/offer-identity";
import { evaluateOfferVerificationGate } from "@/lib/pipeline/offers/offer-gate";
import { extractOffersFromHtml } from "@/lib/pipeline/offers/offer-extract";
import {
  evaluateProductVerificationGate,
  shouldDemoteVerifiedProduct,
} from "@/lib/pipeline/product-verify/product-verify-gate";
import { clampTopNWithoutPadding } from "@/lib/recommend/clampTopN";
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
    assert(valid.config.allowDraftProductInsert === true, "draft insert on");
    assert(
      valid.config.allowUnverifiedIngredientInsert === false,
      "no unverified ingredient"
    );
    assert(valid.config.allowExistingProductOverwrite === false, "no overwrite");
  }
  const bad = validatePipelineOperationConfig({
    ...DEFAULT_PIPELINE_OPERATION,
    allowPublish: true,
  });
  assert(bad.ok === false, "reject allowPublish true");
  checks += 1;

  const inci = parseIngredientList(
    "Aqua, Glycerin, Niacinamide, CI 77491, Parfum, Centella Asiatica Extract (and) Water"
  );
  assert(inci.normalized.length >= 5, "inci token count");
  assert(
    inci.normalized.some((n) => n.normalizedName.includes("ci 77491")),
    "ci pigment"
  );
  assert(
    inci.normalized.some((n) => n.normalizedName === "fragrance"),
    "fragrance alias"
  );
  const matched = attachIngredientMatches(
    parseIngredientList("Water, Glycerin"),
    new Map([
      ["water", 1],
      ["glycerin", 2],
    ])
  );
  assert(matched.normalized[0]?.matchedIngredientId === 1, "exact water match");
  assert(matched.normalized[0]?.matchKind === "exact", "exact kind");
  checks += 1;

  const cat = classifyProductCategory(
    sampleProduct({ productName: "Hydrating Serum", category: null })
  );
  assert(cat.category === "serum", "serum category");
  assert(cat.needsReview === false || cat.confidence >= 0.7, "serum confidence");
  const toneSk = scoreToneUndertone(sampleProduct());
  assert(toneSk.toneRelevance === "not_applicable", "skincare tone n/a again");
  checks += 1;

  const seller = classifyOfferSource({
    purchaseUrl: "https://www.amazon.com/dp/x",
    marketplaceOfficialStoreEvidence: false,
  });
  assert(seller.grade === "marketplace_seller", "exclude marketplace seller");
  const official = classifyOfferSource({
    purchaseUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1",
    sameAsOfficialBrandHost: true,
  });
  assert(official.grade === "official_brand_store", "official brand store");

  const price = parseOfferPrice({ priceText: "19,800원", currencyHint: "KRW" });
  assert(price.price === 19800 && price.currency === "KRW", "krw price");
  const stock = parseStockStatus({
    availability: "https://schema.org/InStock",
  });
  assert(stock.stockStatus === "in_stock", "schema instock");
  const buttonOnly = parseStockStatus({ buttonText: "Add to cart" });
  assert(buttonOnly.stockStatus === "unknown", "button not enough");

  const idMatch = matchOfferToProduct({
    productName: "Snail Mucin 96",
    brandName: "COSRX",
    offerTitle: "COSRX Snail Mucin 96",
    offerBrand: "COSRX",
  });
  assert(
    idMatch.match === "exact_match" || idMatch.match === "strong_match",
    "identity match"
  );

  const offerGateFail = evaluateOfferVerificationGate({
    grade: "marketplace_seller",
    identity: "exact_match",
    identityConfidence: 0.95,
    purchaseUrl: "https://amazon.com/x",
    price: 10,
    currency: "USD",
    stockStatus: "in_stock",
    stockConfidence: 0.9,
    shipsToCountries: ["US"],
    shippingConfidence: 0.8,
    officialConfidenceThreshold: 0.8,
    productActive: true,
  });
  assert(offerGateFail.schemaStatus === "invalid", "seller invalid");

  const htmlOffers = extractOffersFromHtml(
    `<script type="application/ld+json">{"@type":"Offer","price":"12.00","priceCurrency":"USD","availability":"https://schema.org/InStock","url":"https://example.com/p"}</script>`,
    "https://example.com/p"
  );
  assert(htmlOffers.some((o) => o.method === "jsonld_offer"), "jsonld offer");
  checks += 1;

  // Phase 4: draft products may still get verified offers (activation uses them)
  const draftOfferGate = evaluateOfferVerificationGate({
    grade: "official_brand_store",
    identity: "exact_match",
    identityConfidence: 0.95,
    purchaseUrl: "https://example.com/p",
    price: 12000,
    currency: "KRW",
    stockStatus: "in_stock",
    stockConfidence: 0.9,
    shipsToCountries: ["KR"],
    shippingConfidence: 0.9,
    officialConfidenceThreshold: 0.8,
    productActive: false,
  });
  assert(draftOfferGate.passVerified === true, "draft may verify offer");
  assert(
    !draftOfferGate.blockers.includes("product_is_draft"),
    "no product_is_draft blocker"
  );
  checks += 1;

  const productGatePass = evaluateProductVerificationGate({
    active: false,
    verifiedAt: null,
    qualityGrade: "A",
    allowedGrades: ["A", "B"],
    hasOfficialIngredientsText: true,
    structuredOfficialIngredientCount: 3,
    ambiguousIngredientCount: 0,
    unmatchedIngredientCount: 0,
    safetyConflict: false,
    verifiedInStockOfferCount: 1,
    countryEligibleOfferCount: 1,
    allowPublish: false,
    allowProductDemotion: false,
  });
  assert(productGatePass.canActivate === true, "product gate A pass");

  const productGateFail = evaluateProductVerificationGate({
    active: false,
    verifiedAt: null,
    qualityGrade: "C",
    allowedGrades: ["A", "B"],
    hasOfficialIngredientsText: true,
    structuredOfficialIngredientCount: 3,
    ambiguousIngredientCount: 0,
    unmatchedIngredientCount: 0,
    safetyConflict: false,
    verifiedInStockOfferCount: 1,
    countryEligibleOfferCount: 1,
    allowPublish: false,
    allowProductDemotion: false,
  });
  assert(productGateFail.canActivate === false, "grade C blocked");
  assert(productGateFail.needsReview === true, "grade C needs review");

  assert(
    shouldDemoteVerifiedProduct({
      hadVerifiedOffers: true,
      nowHasEligibleOffers: false,
      allowProductDemotion: false,
    }) === false,
    "no demotion"
  );

  assert(
    clampTopNWithoutPadding([1, 2, 3], 5).length === 3,
    "no top5 padding"
  );

  const cfgBad = validatePipelineOperationConfig({
    ...DEFAULT_PIPELINE_OPERATION,
    allowPublish: true,
  });
  assert(cfgBad.ok === false, "publish hard false");

  const cfgOk = validatePipelineOperationConfig({
    ...DEFAULT_PIPELINE_OPERATION,
    version: 4,
    allowProductAutoVerify: true,
  });
  assert(cfgOk.ok === true, "config v4 ok");
  if (cfgOk.ok) {
    assertHardWritePolicy(cfgOk.config);
    assert(cfgOk.config.allowProductDemotion === false, "demotion hard false");
  }
  checks += 1;

  return { ok: true, checks };
}

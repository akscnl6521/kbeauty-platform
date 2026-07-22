/**
 * Phase 2 scenario pilot runtime selftest (offline mocks, no DB/network).
 */
import assert from "node:assert/strict";
import { applySymptomSafetyToRecommendation } from "../src/lib/ai/symptomSafety";
import type { AnalyzeSkinRequest } from "../src/lib/ai/types";
import { clampTopNWithoutPadding } from "../src/lib/recommend/clampTopN";
import { AFFILIATE_SCORE_FORBIDDEN } from "../src/lib/recommend/scenarios/poolRules";
import {
  countRecommendationReadyInPool,
  getPilotScenarioPool,
  getReadySlugsForScenario,
  isPilotInsufficientScenario,
  isPilotRuntimeAbcScenario,
  isRegionalSkuExcludedForKr,
  listPilotPoolScenarioIds,
} from "../src/lib/recommend/scenarios/pilotPhase2/pilotPoolArtifacts";
import { matchPilotScenario } from "../src/lib/recommend/scenarios/pilotPhase2/matchPilotScenario";
import { runScenarioPilotPhase2 } from "../src/lib/recommend/scenarios/pilotPhase2/runScenarioPilotPhase2";
import type { CandidateProduct, Recommendation } from "../src/lib/recommend/types";
import type { ProductOffer } from "../src/lib/recommend/catalogTypes";

function krOffer(productId: string): ProductOffer {
  return {
    id: `offer-${productId}`,
    productId,
    retailerName: "oliveyoung",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    purchaseUrl: "https://www.oliveyoung.co.kr/example",
    price: 25000,
    currency: "KRW",
    stockStatus: "in_stock",
    verificationStatus: "verified",
    isOfficial: true,
    verifiedAt: "2026-07-22T00:00:00.000Z",
    lastCheckedAt: "2026-07-22T00:00:00.000Z",
    active: true,
  };
}

function mockProduct(
  slug: string,
  ingredients: string[],
  brand: string
): CandidateProduct {
  return {
    id: `id-${slug}`,
    slug,
    name: slug,
    name_ko: slug,
    name_ja: null,
    brand,
    category: "cream",
    skin_concern: ["redness", "dryness"],
    key_ingredients: ingredients,
    price_usd: 20,
    offers: [krOffer(`id-${slug}`)],
    link_oliveyoung: "https://www.oliveyoung.co.kr/example",
  };
}

function baseRecommendation(
  overrides: Partial<Recommendation> = {}
): Recommendation {
  return {
    skinConcerns: ["Redness"],
    recommendedIngredients: ["Centella Asiatica", "Panthenol"],
    ingredientsToAvoid: [],
    confidenceScore: 0.8,
    managementLevel: "cosmetic_care",
    ...overrides,
  };
}

function krOfferOosOfficial(productId: string): ProductOffer {
  return {
    id: `offer-oos-${productId}`,
    productId,
    retailerName: "beautyofjoseon",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    purchaseUrl: "https://beautyofjoseon.co.kr/product/example/31/",
    price: 18000,
    currency: "KRW",
    stockStatus: "out_of_stock",
    verificationStatus: "unverified",
    isOfficial: true,
    lastCheckedAt: "2026-07-22T10:40:00+09:00",
    active: true,
  };
}

async function mockFetchFromPool(slugs: string[]): Promise<CandidateProduct[]> {
  const catalog: Record<string, CandidateProduct> = {
    "cosrx-advanced-snail-92-all-in-one-cream": mockProduct(
      "cosrx-advanced-snail-92-all-in-one-cream",
      ["Snail Secretion Filtrate", "Panthenol"],
      "COSRX"
    ),
    "aestura-atobarrier365-cream": mockProduct(
      "aestura-atobarrier365-cream",
      ["Ceramide NP", "Panthenol"],
      "AESTURA"
    ),
    "round-lab-dokdo-cream": mockProduct(
      "round-lab-dokdo-cream",
      ["Hyaluronic Acid", "Panthenol"],
      "ROUND LAB"
    ),
    "torriden-dive-in-serum": mockProduct(
      "torriden-dive-in-serum",
      ["Hyaluronic Acid", "Panthenol"],
      "Torriden"
    ),
    "beauty-of-joseon-glow-serum-propolis-niacinamide": mockProduct(
      "beauty-of-joseon-glow-serum-propolis-niacinamide",
      ["Niacinamide", "Propolis"],
      "Beauty of Joseon"
    ),
    "anua-heartleaf-77-toner": mockProduct(
      "anua-heartleaf-77-toner",
      ["Heartleaf", "Panthenol"],
      "Anua"
    ),
    "round-lab-birch-juice-moisturizing-sunscreen-us": mockProduct(
      "round-lab-birch-juice-moisturizing-sunscreen-us",
      ["Niacinamide"],
      "ROUND LAB"
    ),
    // C scenario — commerce separation fixtures
    "cosrx-aha-bha-clarifying-treatment-toner": mockProduct(
      "cosrx-aha-bha-clarifying-treatment-toner",
      ["Salicylic Acid", "Glycolic Acid"],
      "COSRX"
    ),
    "anua-heartleaf-77-soothing-toner": mockProduct(
      "anua-heartleaf-77-soothing-toner",
      ["Heartleaf", "Panthenol"],
      "Anua"
    ),
    "beauty-of-joseon-green-plum-refreshing-toner": {
      ...mockProduct(
        "beauty-of-joseon-green-plum-refreshing-toner",
        ["Salicylic Acid", "Glycolic Acid", "Prunus Mume Fruit Extract"],
        "Beauty of Joseon"
      ),
      offers: [krOfferOosOfficial("id-beauty-of-joseon-green-plum-refreshing-toner")],
    },
    "round-lab-dokdo-toner": mockProduct(
      "round-lab-dokdo-toner",
      ["Sea Water", "Panthenol"],
      "ROUND LAB"
    ),
    "haruharu-wonder-black-rice-hyaluronic-toner": {
      ...mockProduct(
        "haruharu-wonder-black-rice-hyaluronic-toner",
        ["Hyaluronic Acid", "Glycerin", "Lavender Oil"],
        "Haruharu Wonder"
      ),
      offers: [],
    },
  };
  return slugs
    .map((slug) => catalog[slug])
    .filter((p): p is CandidateProduct => Boolean(p));
}

// 1) A/B/C matching
{
  const a = matchPilotScenario({
    primaryConcern: "redness",
    productCategory: "cream",
    bodyArea: "face",
    sensitivityLevel: "high",
  });
  assert.equal(a?.scenario.scenarioId, "kr-redness-sensitive-cream");

  const b = matchPilotScenario({
    primaryConcern: "dryness",
    productCategory: "serum",
    bodyArea: "face",
    sensitivityLevel: "moderate",
  });
  assert.equal(b?.scenario.scenarioId, "pilot-dryness-barrier-serum");

  const c = matchPilotScenario({
    primaryConcern: "pores",
    productCategory: "toner",
    bodyArea: "face",
    sensitivityLevel: "moderate",
  });
  assert.equal(c?.scenario.scenarioId, "kr-acne-pores-toner");
}

// 2) D/E insufficient
async function testDeInsufficient() {
  const d = matchPilotScenario({
    primaryConcern: "uv",
    productCategory: "sunscreen",
    bodyArea: "face",
    sensitivityLevel: "high",
  });
  assert.equal(d?.scenario.scenarioId, "kr-uv-sunscreen-sensitive");
  assert.equal(isPilotInsufficientScenario(d!.scenario.scenarioId), true);

  const result = await runScenarioPilotPhase2({
    recommendation: baseRecommendation({
      skinConcerns: ["UV", "Sensitivity"],
      recommendedIngredients: ["Zinc Oxide"],
    }),
    fetchCandidatesBySlugs: mockFetchFromPool,
  });
  assert.equal(result.status, "insufficient_verified_candidates");
  assert.equal(result.ranked.length, 0);
  assert.ok(result.snapshot.shortageReason?.includes("kr-uv-sunscreen-sensitive"));
  assert.equal(
    result.snapshot.userMessageKo,
    "검증 제품 보강 중입니다. 현재 이 고민·카테고리에 대해 충분히 검증된 제품이 준비되지 않았습니다."
  );
}

// 3) recommendation_ready 미만 0건
{
  for (const sid of listPilotPoolScenarioIds()) {
    const pool = getPilotScenarioPool(sid);
    assert.ok(pool);
    for (const slot of pool!.slots) {
      if (slot.readiness !== "recommendation_ready") {
        assert.ok(
          !getReadySlugsForScenario(sid).includes(slot.productId),
          `sub-ready slot leaked: ${sid}/${slot.productId}/${slot.readiness}`
        );
      }
    }
  }
}

// 4) Top 3~5 no padding
{
  const top = clampTopNWithoutPadding(
    [
      {
        product: mockProduct("a", ["Panthenol"], "A"),
        score: 1,
        matchedIngredients: ["Panthenol"],
        excludedIngredients: [],
      },
    ],
    5
  );
  assert.equal(top.length, 1);
}

// 5) avoid ingredient exclusion
async function testAvoidExclusion() {
  const result = await runScenarioPilotPhase2({
    recommendation: baseRecommendation({
      skinConcerns: ["Dryness"],
      recommendedIngredients: ["Panthenol", "Hyaluronic Acid"],
      avoidedIngredients: ["Niacinamide"],
    }),
    fetchCandidatesBySlugs: async (slugs) => mockFetchFromPool(slugs),
  });
  if (result.status === "ok") {
    const ids = result.ranked.map((r) => r.product.slug);
    assert.ok(!ids.some((id) => id?.includes("niacinamide")));
  }
}

// 6) allergy exclusion
async function testAllergyExclusion() {
  const result = await runScenarioPilotPhase2({
    recommendation: baseRecommendation({
      skinConcerns: ["Dryness"],
      recommendedIngredients: ["Panthenol"],
      allergyIngredients: ["Propolis"],
    }),
    fetchCandidatesBySlugs: mockFetchFromPool,
  });
  if (result.status === "ok") {
    const slugs = result.ranked.map((r) => r.product.slug ?? "");
    assert.ok(!slugs.includes("beauty-of-joseon-glow-serum-propolis-niacinamide"));
  }
}

// 7) regional SKU
{
  assert.equal(
    isRegionalSkuExcludedForKr("round-lab-birch-juice-moisturizing-sunscreen-us"),
    true
  );
  const readyD = getReadySlugsForScenario("kr-uv-sunscreen-sensitive");
  assert.ok(
    !readyD.includes("round-lab-birch-juice-moisturizing-sunscreen-us"),
    "US SKU must not be recommendation_ready in pool"
  );
}

// 8) same product in multiple scenarios
{
  const aReady = getReadySlugsForScenario("kr-redness-sensitive-cream");
  const bReady = getReadySlugsForScenario("pilot-dryness-barrier-serum");
  const shared = aReady.filter((id) => bReady.includes(id));
  assert.ok(shared.length >= 1, "expected shared SKU across A and B");
}

// 9) organic vs affiliate
{
  assert.equal(AFFILIATE_SCORE_FORBIDDEN, true);
  for (const sid of ["kr-redness-sensitive-cream", "pilot-dryness-barrier-serum", "kr-acne-pores-toner"]) {
    const pool = getPilotScenarioPool(sid);
    assert.equal(pool?.affiliateOrAdInScore, false);
  }
}

// 10) symptomSafety before recommend (urgent_check)
async function testSymptomSafetyPriority() {
  let rec = baseRecommendation({ managementLevel: "cosmetic_care" });
  const input: AnalyzeSkinRequest = {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: ["붉은기"],
    sensitivity: "보통",
    concernObservations: [
      {
        concern: "붉은기",
        areas: ["eye_area"],
        severity: "moderate",
        duration: "under_3_days",
        worsening: true,
        redFlags: ["eye_irritation"],
      },
    ],
  };
  rec = applySymptomSafetyToRecommendation(rec, input);
  assert.equal(rec.managementLevel, "urgent_check");

  const blocked = await runScenarioPilotPhase2({
    recommendation: rec,
    fetchCandidatesBySlugs: mockFetchFromPool,
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.ranked.length, 0);
}

// 11) snapshot versions
async function testSnapshotVersions() {
  const result = await runScenarioPilotPhase2({
    recommendation: baseRecommendation({
      skinConcerns: ["Redness"],
      recommendedIngredients: ["Panthenol", "Centella Asiatica"],
    }),
    fetchCandidatesBySlugs: mockFetchFromPool,
  });
  assert.ok(result.snapshot.candidatePoolVersion.includes("2026-07-22"));
  assert.ok(result.snapshot.scenarioVersion);
  assert.ok(result.snapshot.productEvidenceVersion);
}

// 12) C Top 3 with OOS / availability_unknown (Phase 2.5 commerce separation)
async function testCTop3CommerceSeparation() {
  const result = await runScenarioPilotPhase2({
    recommendation: baseRecommendation({
      skinConcerns: ["Pores", "Acne"],
      recommendedIngredients: [
        "Heartleaf",
        "Salicylic Acid",
        "Glycolic Acid",
        "Niacinamide",
        "Hyaluronic Acid",
      ],
    }),
    fetchCandidatesBySlugs: mockFetchFromPool,
    shippingCountry: "KR",
  });

  assert.equal(
    result.status,
    "ok",
    `C expected ok, got ${result.status}: ${result.snapshot.shortageReason ?? ""}`
  );
  assert.equal(result.snapshot.scenarioId, "kr-acne-pores-toner");
  assert.ok(
    result.ranked.length >= 3,
    `C Top expected >=3, got ${result.ranked.length}`
  );
  const slugs = result.ranked.map((r) => r.product.slug);
  assert.ok(
    slugs.includes("beauty-of-joseon-green-plum-refreshing-toner"),
    "BOJ OOS must remain in Organic Top"
  );
  const boj = result.ranked.find(
    (r) => r.product.slug === "beauty-of-joseon-green-plum-refreshing-toner"
  );
  assert.equal(
    (boj?.product.purchase_links ?? []).length,
    0,
    "BOJ OOS must not expose purchasable CTA links"
  );
}

async function main() {
  await testDeInsufficient();
  await testAvoidExclusion();
  await testAllergyExclusion();
  await testSymptomSafetyPriority();
  await testSnapshotVersions();
  await testCTop3CommerceSeparation();

  assert.equal(countRecommendationReadyInPool("kr-redness-sensitive-cream"), 6);
  assert.equal(countRecommendationReadyInPool("pilot-dryness-barrier-serum"), 7);
  assert.equal(countRecommendationReadyInPool("kr-acne-pores-toner"), 5);
  assert.ok(isPilotRuntimeAbcScenario("kr-redness-sensitive-cream"));
  assert.ok(!isPilotRuntimeAbcScenario("kr-uv-sunscreen-sensitive"));

  console.log("recommendation scenario phase2 selftest: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

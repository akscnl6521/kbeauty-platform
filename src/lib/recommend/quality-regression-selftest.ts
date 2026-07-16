/**
 * Evidence Layer + 한국 제품 추천 품질 회귀.
 * 8개 고민: 증상→근거→KR 랭킹→추천 이유→주의→상담 분기.
 * 실패: 테스트·미검수 제품 노출, 고민별 동일 추천 fingerprint.
 */
import { applyEvidenceToRecommendation } from "@/lib/evidence/applyEvidenceToRecommendation";
import { loadStaticApprovedEvidenceForConcerns } from "@/lib/evidence/staticCatalog";
import { isKoreanBeautyBrand } from "@/lib/brand/displayBrandName";
import {
  applyRednessObservationToRecommendation,
  isRednessCounselingPriority,
} from "@/lib/ai/rednessObservation";
import { buildMatchReason } from "@/lib/recommend/buildMatchReason";
import { clampTopNWithoutPadding } from "@/lib/recommend/clampTopN";
import { filterCandidatesBySafety } from "@/lib/recommend/filterCandidatesBySafety";
import { filterRankedByMatchEvidence } from "@/lib/recommend/filterRankedByMatchEvidence";
import { filterCandidatesByOfferAvailability } from "@/lib/recommend/productOffer";
import {
  filterOutStimulatingActives,
  filterPublicCatalogProducts,
  isExcludedFromPublicCatalog,
} from "@/lib/recommend/publicCatalogFilter";
import { rankProducts } from "@/lib/recommend/rankProducts";
import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import type {
  CandidateProduct,
  Recommendation,
} from "@/lib/recommend/types";
import {
  CORE_RECOMMEND_OFFER_COUNTRY,
  RANKED_PRODUCTS_TOP_N,
} from "@/lib/recommend/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[quality-regression] ${msg}`);
}

/** Evidence catalog 8 concerns (퀴즈 7 + sensitivity) */
export const QUALITY_REGRESSION_CONCERNS: readonly {
  label: string;
  code: string;
}[] = [
  { label: "붉은기", code: "redness" },
  { label: "건조함", code: "dryness" },
  { label: "민감", code: "sensitivity" },
  { label: "여드름", code: "acne" },
  { label: "색소침착", code: "pigmentation" },
  { label: "주름", code: "antiaging" },
  { label: "모공", code: "pores" },
  { label: "자외선", code: "uv" },
] as const;

function krVerifiedOffer(productId: string): ProductOffer {
  return {
    id: `offer-${productId}`,
    productId,
    retailerName: "Olive Young",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    purchaseUrl: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${productId}`,
    price: 18000,
    currency: "KRW",
    stockStatus: "in_stock",
    verificationStatus: "verified",
    verifiedAt: "2026-07-01T00:00:00.000Z",
    isOfficial: true,
    active: true,
  };
}

function usUnverifiedOffer(productId: string): ProductOffer {
  return {
    id: `offer-us-${productId}`,
    productId,
    retailerName: "Amazon US",
    retailerCountry: "US",
    shipsToCountries: ["US"],
    purchaseUrl: `https://www.amazon.com/dp/${productId}`,
    price: 20,
    currency: "USD",
    stockStatus: "in_stock",
    verificationStatus: "unverified",
    isOfficial: false,
    active: true,
  };
}

function baseCandidate(
  partial: Partial<CandidateProduct> &
    Pick<CandidateProduct, "id" | "name" | "slug" | "key_ingredients">
): CandidateProduct {
  return {
    name_ko: partial.name_ko ?? partial.name,
    name_ja: null,
    brand: partial.brand ?? "COSRX",
    category: partial.category ?? "serum",
    skin_concern: partial.skin_concern ?? [],
    skin_tone: null,
    key_ingredients_ja: null,
    price_usd: null,
    recommendation_reason: null,
    recommendation_reason_ko: null,
    recommendation_reason_ja: null,
    link_sephora: null,
    link_amazon_us: null,
    link_amazon_jp: null,
    link_qoo10: null,
    link_oliveyoung: null,
    link_coupang: null,
    link_yesstyle: null,
    offers: partial.offers ?? [krVerifiedOffer(partial.id)],
    ...partial,
  };
}

/** Verified + KR offer 정상 제품 + 노이즈(테스트/미검수) 혼합 fixture */
function buildMixedCatalog(): CandidateProduct[] {
  const good: CandidateProduct[] = [
    baseCandidate({
      id: "p-niacinamide",
      name: "The Niacinamide 15 Serum",
      name_ko: "더 나이아신아마이드 15 세럼",
      slug: "cosrx-the-niacinamide-15-serum",
      key_ingredients: ["Niacinamide", "Zinc PCA", "Allantoin"],
      skin_concern: ["acne", "pores", "pigmentation"],
    }),
    baseCandidate({
      id: "p-retinol",
      name: "The Retinol 0.1 Cream",
      name_ko: "더 레티놀 0.1 크림",
      slug: "cosrx-the-retinol-0-1-cream",
      key_ingredients: ["Retinol", "Adenosine", "Panthenol"],
      skin_concern: ["antiaging", "wrinkle"],
    }),
    baseCandidate({
      id: "p-aha-bha",
      name: "AHA/BHA Clarifying Treatment Toner",
      name_ko: "AHA BHA 클라리파잉 트리트먼트 토너",
      slug: "cosrx-aha-bha-clarifying-treatment-toner",
      key_ingredients: ["Salicylic Acid", "Glycolic Acid", "Panthenol"],
      skin_concern: ["pores", "acne"],
    }),
    baseCandidate({
      id: "p-snail",
      name: "Advanced Snail 96 Mucin Power Essence",
      name_ko: "어드밴스드 스네일 96 뮤신 파워 에센스",
      slug: "cosrx-advanced-snail-96-mucin-power-essence",
      key_ingredients: [
        "Snail Secretion Filtrate",
        "Sodium Hyaluronate",
        "Panthenol",
      ],
      skin_concern: ["dryness", "redness", "sensitivity"],
    }),
    baseCandidate({
      id: "p-sunscreen",
      name: "Mineral Soft Sun Cream",
      name_ko: "미네랄 소프트 선크림",
      slug: "cosrx-mineral-soft-sun-cream",
      brand: "COSRX",
      category: "sunscreen",
      key_ingredients: ["Zinc Oxide", "Titanium Dioxide", "Panthenol"],
      skin_concern: ["uv"],
    }),
    baseCandidate({
      id: "p-centella",
      name: "Centella Blemish Cream",
      name_ko: "센텔라 블레미쉬 크림",
      slug: "cosrx-centella-blemish-cream",
      key_ingredients: ["Centella Asiatica", "Panthenol", "Madecassoside"],
      skin_concern: ["redness", "sensitivity"],
    }),
  ];

  const noise: CandidateProduct[] = [
    baseCandidate({
      id: "p-probe-http",
      name: "HTTP API Alias Probe 999",
      name_ko: "HTTP API alias SELECT 검증용 제품",
      slug: "http-api-alias-probe-999",
      key_ingredients: ["Niacinamide"],
      skin_concern: ["acne"],
    }),
    baseCandidate({
      id: "p-fixture",
      name: "Staging Probe Fixture Serum",
      name_ko: "테스트 제품 세럼",
      slug: "fixture-test-only-serum",
      key_ingredients: ["Retinol"],
      skin_concern: ["antiaging"],
    }),
    baseCandidate({
      id: "p-us-only",
      name: "US Only Moisturizer",
      name_ko: "미국 전용 보습",
      slug: "us-only-moisturizer",
      brand: "GenericUS",
      key_ingredients: ["Ceramide", "Hyaluronic Acid"],
      skin_concern: ["dryness"],
      offers: [usUnverifiedOffer("p-us-only")],
    }),
    baseCandidate({
      id: "p-unverified-offer",
      name: "Unverified Offer Cream",
      name_ko: "미검증 오퍼 크림",
      slug: "unverified-offer-cream",
      key_ingredients: ["Panthenol"],
      skin_concern: ["redness"],
      offers: [
        {
          ...krVerifiedOffer("p-unverified-offer"),
          verificationStatus: "unverified",
          verifiedAt: undefined,
        },
      ],
    }),
  ];

  return [...good, ...noise];
}

type ConcernRun = {
  label: string;
  code: string;
  evidenceSlugs: string[];
  pmids: string[];
  precautions: string[];
  topIds: string[];
  topNames: string[];
  reasons: string[];
  managementLevel: string;
  fingerprint: string;
};

function runConcernPipeline(
  label: string,
  code: string,
  catalog: CandidateProduct[],
  overrides?: Partial<Recommendation>
): ConcernRun {
  const evidence = loadStaticApprovedEvidenceForConcerns([label]);
  assert(evidence.length >= 1, `${label}: evidence required`);
  assert(
    evidence.every((e) => e.concernCode === code),
    `${label}: concernCode mismatch`
  );
  assert(
    evidence.every((e) => e.pmid || e.doi || e.sourceUrl),
    `${label}: citation required`
  );

  let rec: Recommendation = {
    skinConcerns: [label],
    recommendedIngredients: [],
    ingredientsToAvoid: [],
    confidenceScore: 0.72,
    managementLevel: "cosmetic_care",
    ...overrides,
  };
  rec = applyEvidenceToRecommendation(rec, evidence);
  assert((rec.evidenceLinks?.length ?? 0) >= 1, `${label}: evidenceLinks`);
  assert((rec.precautions?.length ?? 0) >= 1, `${label}: precautions`);
  assert(
    (rec.recommendedIngredients?.length ?? 0) >= 1,
    `${label}: recommendedIngredients`
  );

  const publicOnly = filterPublicCatalogProducts(catalog);
  for (const p of publicOnly) {
    assert(
      !isExcludedFromPublicCatalog(p),
      `${label}: probe leaked into public pool (${p.slug})`
    );
  }
  assert(
    publicOnly.every(
      (p) =>
        !/probe|fixture|http-api|검증용|테스트\s*제품/i.test(
          `${p.name}\n${p.name_ko}\n${p.slug}`
        )
    ),
    `${label}: test/unreviewed naming leaked`
  );

  const { eligible: sellable } = filterCandidatesByOfferAvailability(
    publicOnly,
    CORE_RECOMMEND_OFFER_COUNTRY
  );
  assert(sellable.length >= 1, `${label}: KR verified offer pool empty`);
  for (const p of sellable) {
    assert(
      !isExcludedFromPublicCatalog(p),
      `${label}: probe in KR offer pool`
    );
  }

  let pool = sellable;
  const risk =
    rec.managementLevel === "expert_first" ||
    rec.managementLevel === "urgent_check";
  if (risk) {
    pool = filterOutStimulatingActives(pool);
  }

  const { safe } = filterCandidatesBySafety(pool, rec);
  const ranked = rankProducts(rec, safe);
  const withMatch = filterRankedByMatchEvidence(ranked);
  const top = clampTopNWithoutPadding(withMatch, RANKED_PRODUCTS_TOP_N);
  assert(top.length >= 1, `${label}: empty TopN after match gate`);

  for (const row of top) {
    assert(
      !isExcludedFromPublicCatalog(row.product),
      `${label}: ranked probe/test product ${row.product.slug}`
    );
    assert(
      isKoreanBeautyBrand(row.product.brand),
      `${label}: non-KR brand in core top (${row.product.brand})`
    );
  }

  const reasons = top.map((row) =>
    buildMatchReason({
      recommendation: rec,
      matchedIngredients: row.matchedIngredients,
      product: row.product,
    })
  );
  for (const reason of reasons) {
    assert(reason.includes(label) || reason.length > 20, `${label}: weak reason`);
  }

  const evidenceSlugs = [
    ...new Set(evidence.map((e) => e.ingredientSlug)),
  ].sort();
  const pmids = [...new Set(evidence.map((e) => e.pmid ?? ""))].sort();
  const topIds = top.map((t) => t.product.id);
  const topNames = top.map((t) => t.product.name ?? "");
  const precautions = [...(rec.precautions ?? [])];

  const fingerprint = [
    code,
    evidenceSlugs.join(","),
    pmids.join(","),
    topIds.join(","),
    reasons[0]?.slice(0, 120) ?? "",
    precautions[0] ?? "",
    rec.managementLevel ?? "",
  ].join("||");

  return {
    label,
    code,
    evidenceSlugs,
    pmids,
    precautions,
    topIds,
    topNames,
    reasons,
    managementLevel: rec.managementLevel ?? "cosmetic_care",
    fingerprint,
  };
}

export function runRecommendQualityRegressionSelftests(): {
  ok: true;
  checks: number;
  concerns: number;
  fingerprints: string[];
} {
  let checks = 0;
  const catalog = buildMixedCatalog();

  // --- A. 공개 필터: 테스트·probe 제외 ---
  const probes = catalog.filter((p) => isExcludedFromPublicCatalog(p));
  assert(probes.length >= 2, "fixture must include probe/test products");
  const filtered = filterPublicCatalogProducts(catalog);
  assert(
    filtered.every((p) => !isExcludedFromPublicCatalog(p)),
    "filtered catalog still has excluded products"
  );
  assert(
    !filtered.some((p) => p.id === "p-probe-http" || p.id === "p-fixture"),
    "probe/fixture ids must not survive public filter"
  );
  checks += 1;

  // --- B. KR offer 게이트: 미검수·타국 제외 ---
  const { eligible, excludedCount } = filterCandidatesByOfferAvailability(
    filtered,
    CORE_RECOMMEND_OFFER_COUNTRY
  );
  assert(excludedCount >= 2, "unverified/US offers must be excluded");
  assert(
    !eligible.some((p) => p.id === "p-us-only" || p.id === "p-unverified-offer"),
    "unreviewed offer products leaked into KR core pool"
  );
  checks += 1;

  // --- C. 8개 고민 파이프라인 + fingerprint 유일성 ---
  const runs: ConcernRun[] = [];
  for (const { label, code } of QUALITY_REGRESSION_CONCERNS) {
    runs.push(runConcernPipeline(label, code, catalog));
  }
  assert(runs.length === 8, "must cover 8 concerns");
  checks += 1;

  const fps = runs.map((r) => r.fingerprint);
  assert(
    new Set(fps).size === fps.length,
    `duplicate concern recommendation fingerprints: ${fps.join(" ## ")}`
  );
  checks += 1;

  // PMID 집합도 고민별로 달라야 함 (동일 추천 붕괴 방지)
  const pmidKeys = runs.map((r) => r.pmids.join(","));
  assert(
    new Set(pmidKeys).size === pmidKeys.length,
    "identical PMID sets across different concerns"
  );
  checks += 1;

  // 주의사항도 고민별로 적어도 첫 문장이 달라야 함
  const prec0 = runs.map((r) => r.precautions[0] ?? "");
  assert(
    new Set(prec0).size === prec0.length,
    "identical primary precaution across concerns"
  );
  checks += 1;

  // --- D. 상담 분기: 붉은기 위험 관찰 → expert_first + 자극 활성 제외 ---
  const riskyObs = {
    trigger: "unknown" as const,
    duration: "recurrent" as const,
    symptoms: ["burning" as const],
    areas: ["cheeks" as const],
  };
  assert(isRednessCounselingPriority(riskyObs), "counseling priority signal");
  const elevated = applyRednessObservationToRecommendation(
    {
      skinConcerns: ["붉은기"],
      recommendedIngredients: ["판테놀"],
      ingredientsToAvoid: [],
      confidenceScore: 0.7,
      managementLevel: "cosmetic_care",
    },
    riskyObs
  );
  assert(
    elevated.managementLevel === "expert_first",
    "counseling must elevate to expert_first"
  );
  assert(
    (elevated.expertReferralReasons?.length ?? 0) >= 1 ||
      (elevated.notRecommendedReasons?.length ?? 0) >= 1,
    "counseling reasons required"
  );

  const riskRun = runConcernPipeline("붉은기", "redness", catalog, {
    managementLevel: "expert_first",
    expertReferralReasons: elevated.expertReferralReasons,
    notRecommendedReasons: elevated.notRecommendedReasons,
  });
  assert(
    riskRun.managementLevel === "expert_first",
    "risk pipeline keeps expert_first"
  );
  assert(
    !riskRun.topIds.includes("p-retinol"),
    "expert_first must not rank stimulating retinol"
  );
  assert(
    !riskRun.topIds.includes("p-aha-bha"),
    "expert_first must not rank AHA/BHA"
  );
  checks += 1;

  // --- E. 여드름은 살리실산 보강 포함 ---
  const acne = runs.find((r) => r.code === "acne");
  assert(acne != null, "acne run missing");
  assert(
    acne!.evidenceSlugs.includes("salicylic-acid"),
    "acne must include salicylic reinforcement"
  );
  assert(
    acne!.evidenceSlugs.includes("niacinamide"),
    "acne must keep niacinamide"
  );
  checks += 1;

  return {
    ok: true,
    checks,
    concerns: runs.length,
    fingerprints: fps,
  };
}

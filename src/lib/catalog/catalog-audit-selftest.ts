/**
 * 카탈로그 감사·신뢰 상태·중복 탐지 selftest (표시/관리자 전용, 점수 불변).
 */
import {
  buildCatalogAuditReport,
  catalogAuditToCsv,
  catalogTrustStatusUserLabelKo,
  explainOfferEligibilityFailures,
  type CatalogAuditOfferRow,
  type CatalogAuditProductRow,
} from "@/lib/catalog/catalogAudit";
import { resolveDisplaySizeLabel } from "@/lib/catalog/verifiedDisplayOverrides";
import {
  getProductTrustStatus,
  productTrustStatusLabel,
  stripTrailingSizeFromProductName,
} from "@/lib/recommend/displayProductMeta";
import { isOfferEligibleForCoreRecommendation } from "@/lib/recommend/productOffer";
import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import { displayProductTitle } from "@/lib/brand/displayBrandName";
import { formatOfferPrice } from "@/lib/recommend/selectPurchaseLink";
import { rankProducts } from "@/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "@/lib/recommend/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[catalog-audit-selftest] ${msg}`);
}

function baseProduct(
  overrides: Partial<CatalogAuditProductRow> & { id: string }
): CatalogAuditProductRow {
  return {
    brand: "COSRX",
    name: "Advanced Snail 96 Mucin Power Essence",
    nameKo: "어드밴스드 스네일 96 뮤신 파워 에센스",
    nameJa: null,
    category: "essence",
    active: true,
    verifiedAt: null,
    dataConfidence: null,
    keyIngredients: ["Snail Secretion Filtrate"],
    skinConcern: ["Dryness"],
    imageUrl: null,
    slug: "cosrx-snail-96",
    sourceUrl: null,
    ...overrides,
  };
}

function baseOffer(
  overrides: Partial<CatalogAuditOfferRow> & {
    id: string;
    productId: string;
  }
): CatalogAuditOfferRow {
  return {
    retailerName: "COSRX Official KR",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    purchaseUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    price: 23000,
    currency: "KRW",
    stockStatus: "in_stock",
    verificationStatus: "verified",
    isOfficial: true,
    verifiedAt: "2026-07-13T00:00:00.000Z",
    active: true,
    ...overrides,
  };
}

function asOffer(row: CatalogAuditOfferRow): ProductOffer {
  const country = (row.retailerCountry || "KR").toUpperCase();
  const retailerCountry =
    country === "KR" || country === "US" || country === "JP" || country === "GLOBAL"
      ? country
      : "GLOBAL";
  const ships = (row.shipsToCountries || []).map((c) => c.toUpperCase()) as ProductOffer["shipsToCountries"];
  return {
    id: row.id,
    productId: row.productId,
    retailerName: row.retailerName,
    retailerCountry: retailerCountry as ProductOffer["retailerCountry"],
    shipsToCountries: ships.length
      ? ships.filter((c): c is "KR" | "US" | "JP" =>
          c === "KR" || c === "US" || c === "JP"
        )
      : [],
    purchaseUrl: row.purchaseUrl,
    price: row.price ?? undefined,
    currency: (row.currency as ProductOffer["currency"]) || undefined,
    stockStatus:
      row.stockStatus === "in_stock" || row.stockStatus === "out_of_stock"
        ? row.stockStatus
        : "unknown",
    verificationStatus:
      row.verificationStatus === "verified" ||
      row.verificationStatus === "unverified" ||
      row.verificationStatus === "invalid" ||
      row.verificationStatus === "unavailable"
        ? row.verificationStatus
        : "unverified",
    isOfficial: row.isOfficial === true,
    verifiedAt: row.verifiedAt || undefined,
    active: row.active !== false,
  };
}

export function runCatalogAuditSelftests(): { ok: true; checks: number } {
  let checks = 0;

  // --- 이름 fallback ---
  assert(
    displayProductTitle({ name: "", nameKo: "", locale: "ko" }) ===
      "제품명 확인 중",
    "empty name ko fallback"
  );
  assert(
    displayProductTitle({
      name: "Advanced Snail 96",
      nameKo: "어드밴스드 스네일 96",
      locale: "ko",
    }) === "어드밴스드 스네일 96",
    "ko name priority"
  );
  assert(
    displayProductTitle({
      name: "Advanced Snail 96",
      nameKo: "",
      locale: "en",
    }) === "Advanced Snail 96",
    "en name fallback"
  );
  assert(
    stripTrailingSizeFromProductName("에센스 100ml") === "에센스",
    "size strip"
  );
  assert(
    resolveDisplaySizeLabel({
      productId: "4",
      name: "Snail Mucin 96% Power Repairing Essence",
      nameKo: "달팽이 뮤신 96% 에센스",
    }) === "100 ml",
    "cosrx 4 size override"
  );
  assert(
    resolveDisplaySizeLabel({
      productId: "28",
      name: "Advanced Snail 92 All in One Cream",
      nameKo: "어드밴스드 스네일 92 올인원 크림",
    }) === "100 g",
    "cosrx 28 size override"
  );
  checks += 1;

  // --- 중복 후보: 동일 용량만 그룹 / 다른 용량은 비중복 ---
  const dupReport = buildCatalogAuditReport(
    [
      baseProduct({ id: "a1", name: "Same Essence 100ml", nameKo: "동일 에센스 100ml" }),
      baseProduct({ id: "a2", name: "Same Essence 100ml", nameKo: "동일 에센스 100ml" }),
      baseProduct({ id: "b1", name: "Same Essence 50ml", nameKo: "동일 에센스 50ml" }),
    ],
    []
  );
  assert(
    dupReport.duplicateGroups.some((g) =>
      g.productIds.includes("a1") && g.productIds.includes("a2")
    ),
    "same size duplicate group"
  );
  assert(
    !dupReport.duplicateGroups.some(
      (g) => g.productIds.includes("a1") && g.productIds.includes("b1")
    ),
    "different size not duplicate"
  );
  checks += 1;

  // --- offer eligibility ---
  const good = asOffer(baseOffer({ id: "o1", productId: "4" }));
  assert(
    isOfferEligibleForCoreRecommendation(good, "KR"),
    "strict verified offer ok"
  );
  assert(
    !isOfferEligibleForCoreRecommendation(
      asOffer(baseOffer({ id: "o2", productId: "4", price: 0 })),
      "KR"
    ),
    "price 0 no CTA"
  );
  assert(
    !isOfferEligibleForCoreRecommendation(
      asOffer(baseOffer({ id: "o3", productId: "4", price: null })),
      "KR"
    ),
    "price null no CTA"
  );
  assert(
    !isOfferEligibleForCoreRecommendation(
      asOffer(
        baseOffer({
          id: "o4",
          productId: "4",
          purchaseUrl: "http://www.cosrx.co.kr/x",
        })
      ),
      "KR"
    ),
    "http no CTA"
  );
  assert(
    !isOfferEligibleForCoreRecommendation(
      asOffer(
        baseOffer({
          id: "o5",
          productId: "4",
          verificationStatus: "unverified",
          verifiedAt: null,
        })
      ),
      "KR"
    ),
    "unverified no CTA"
  );
  assert(
    !isOfferEligibleForCoreRecommendation(
      asOffer(
        baseOffer({ id: "o6", productId: "4", stockStatus: "out_of_stock" })
      ),
      "KR"
    ),
    "out of stock no CTA"
  );
  assert(
    !isOfferEligibleForCoreRecommendation(
      asOffer(baseOffer({ id: "o7", productId: "4", currency: "USD" })),
      "KR"
    ),
    "non-KRW KR offer no CTA"
  );
  assert(
    !isOfferEligibleForCoreRecommendation(
      asOffer(
        baseOffer({ id: "o8", productId: "4", shipsToCountries: ["US"] })
      ),
      "KR"
    ),
    "ships_to missing KR no CTA"
  );
  assert(formatOfferPrice(0, "KRW", "ko") === "가격 정보 없음", "no won zero");
  assert(formatOfferPrice(undefined, "KRW", "ko") === "가격 정보 없음", "null price");
  checks += 1;

  // --- 국가 분리 ---
  const usOffer = asOffer(
    baseOffer({
      id: "ou",
      productId: "4",
      retailerCountry: "US",
      shipsToCountries: ["US"],
      currency: "USD",
      price: 20,
      stockStatus: "unknown",
    })
  );
  assert(
    !isOfferEligibleForCoreRecommendation(usOffer, "KR"),
    "US offer not for KR"
  );
  assert(
    isOfferEligibleForCoreRecommendation(usOffer, "US"),
    "US offer for US"
  );
  const fails = explainOfferEligibilityFailures(usOffer, "KR");
  assert(fails.length > 0, "eligibility failure reasons present");
  checks += 1;

  // --- trust status + COSRX audit ---
  assert(
    getProductTrustStatus({
      productVerifiedAt: "2026-07-13",
      hasVerifiedOffer: true,
    }) === "verified_ready",
    "trust verified_ready"
  );
  assert(
    productTrustStatusLabel("verified_ready", "ko") ===
      "제품 및 판매처 확인 완료",
    "trust label"
  );
  assert(
    catalogTrustStatusUserLabelKo("manual_review") === null,
    "manual_review hidden on user UI"
  );

  const cosrxReport = buildCatalogAuditReport(
    [
      baseProduct({
        id: "4",
        verifiedAt: "2026-07-13T00:00:00.000Z",
        name: "Snail Mucin 96% Power Repairing Essence",
        nameKo: "달팽이 뮤신 96% 에센스",
      }),
      baseProduct({
        id: "28",
        verifiedAt: "2026-07-13T00:00:00.000Z",
        name: "Advanced Snail 92 All in One Cream",
        nameKo: "어드밴스드 스네일 92 올인원 크림",
        category: "cream",
      }),
    ],
    [
      baseOffer({ id: "o4", productId: "4" }),
      baseOffer({
        id: "o28",
        productId: "28",
        purchaseUrl:
          "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
      }),
    ]
  );
  const p4 = cosrxReport.products.find((p) => p.id === "4")!;
  const p28 = cosrxReport.products.find((p) => p.id === "28")!;
  assert(p4.status === "verified_ready", "cosrx 4 verified_ready");
  assert(p4.sizeLabel === "100 ml", "cosrx 4 size");
  assert(p4.krPrice === 23000, "cosrx 4 price");
  assert(p4.displayNameKo.includes("100") === false, "name size not duplicated");
  assert(p28.sizeLabel === "100 g", "cosrx 28 size");
  assert(p28.krPrice === 23000, "cosrx 28 price");
  checks += 1;

  // --- CSV no secrets ---
  const csv = catalogAuditToCsv([
    {
      id: p4.id,
      brand: p4.brand,
      status: p4.status,
      kr_price: p4.krPrice,
    },
  ]);
  assert(!/service_role|SUPABASE|api[_-]?key|password|email@/i.test(csv), "csv clean");
  checks += 1;

  // --- rankProducts 불변 스모크 ---
  const rec: Recommendation = {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Snail Mucin"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const products: RankableProduct[] = [
    { id: "4", key_ingredients: ["Snail Secretion Filtrate"], skin_concern: ["Dryness"] },
  ];
  const ranked = rankProducts(rec, products);
  assert(ranked.length === 1 && ranked[0]!.score > 0, "rankProducts unchanged smoke");
  checks += 1;

  return { ok: true, checks };
}

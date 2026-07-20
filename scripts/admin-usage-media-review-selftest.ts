import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isUsageMediaDisplayEligible } from "../src/lib/media/isUsageMediaDisplayEligible";
import { evaluateCatalogProductMediaDisplay } from "../src/lib/admin/product-usage-media-eligibility";
import type { UsageMediaAsset } from "../src/lib/media/productUsageMediaPolicy";
import { rankProducts } from "../src/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "../src/lib/recommend/types";

async function main() {
  const baseAsset: UsageMediaAsset = {
    id: "media-1",
    productId: "product-1",
    mediaType: "video",
    sourceUrl: "https://cdn.example.com/demo.mp4",
    storagePath: null,
    rightsStatus: "owned",
    rightsExpiresAt: null,
    consentReference: null,
    reviewStatus: "approved",
    productMatchVerified: true,
    applicationDemonstrationVerified: true,
    containsMedicalClaim: false,
    containsBeforeAfter: false,
    isSponsored: false,
    sponsorName: null,
    disclosureText: null,
    locale: "ko-KR",
  };

  const now = new Date("2026-07-20T00:00:00Z");

  const ok = isUsageMediaDisplayEligible(baseAsset, now);
  assert.equal(ok.eligible, true);
  assert.equal(ok.checklist.httpsSource, true);

  const http = isUsageMediaDisplayEligible(
    { ...baseAsset, sourceUrl: "http://cdn.example.com/demo.mp4" },
    now
  );
  assert.equal(http.eligible, false);
  assert.ok(http.reasonCodes.includes("https_required"));

  const unverified = isUsageMediaDisplayEligible(
    { ...baseAsset, reviewStatus: "needs_review" },
    now
  );
  assert.equal(unverified.eligible, false);
  assert.ok(unverified.reasonCodes.includes("media_not_approved"));

  const expired = isUsageMediaDisplayEligible(
    {
      ...baseAsset,
      rightsStatus: "licensed",
      consentReference: "lic-1",
      rightsExpiresAt: "2026-07-19T00:00:00Z",
    },
    now
  );
  assert.equal(expired.eligible, false);
  assert.ok(expired.reasonCodes.includes("rights_expired"));

  const sponsoredNoDisclosure = isUsageMediaDisplayEligible(
    {
      ...baseAsset,
      isSponsored: true,
      sponsorName: null,
      disclosureText: null,
    },
    now
  );
  assert.equal(sponsoredNoDisclosure.eligible, false);
  assert.ok(
    sponsoredNoDisclosure.reasonCodes.includes("sponsorship_disclosure_missing")
  );

  const sponsoredOk = isUsageMediaDisplayEligible(
    {
      ...baseAsset,
      isSponsored: true,
      sponsorName: "테스트",
      disclosureText: "유료 광고가 포함되어 있습니다.",
    },
    now
  );
  assert.equal(sponsoredOk.eligible, true);
  assert.equal(sponsoredOk.requiresDisclosure, true);

  const official = isUsageMediaDisplayEligible(baseAsset, now);
  assert.equal(official.requiresDisclosure, false);

  const catalogBase = {
    productId: 17 as number | null,
    imageUrl: "https://cdn.example.com/a.jpg",
    canonicalImageUrl: null as string | null,
    sourcePageUrl: "https://brand.example/p",
    sourceType: "official_brand",
    usageRightsStatus: "official_remote_use",
    validationStatus: "verified",
    verifiedAt: "2026-07-18T00:00:00Z",
    rightsNotes: null as string | null,
  };

  const catalogOk = evaluateCatalogProductMediaDisplay(catalogBase);
  assert.equal(catalogOk.displayEligible, true);

  const catalogHttp = evaluateCatalogProductMediaDisplay({
    ...catalogBase,
    imageUrl: "http://cdn.example.com/a.jpg",
    canonicalImageUrl: null,
    sourcePageUrl: "http://brand.example/p",
  });
  assert.equal(catalogHttp.displayEligible, false);
  assert.ok(catalogHttp.ineligibilityReasons.includes("https_required"));

  const catalogUnverified = evaluateCatalogProductMediaDisplay({
    ...catalogBase,
    validationStatus: "needs_review",
    verifiedAt: null,
  });
  assert.equal(catalogUnverified.displayEligible, false);

  const catalogAi = evaluateCatalogProductMediaDisplay({
    ...catalogBase,
    sourceType: "ai_generated",
  });
  assert.equal(catalogAi.displayEligible, false);
  assert.ok(
    catalogAi.ineligibilityReasons.includes("disclosure_schema_missing")
  );

  const page = await readFile("src/app/admin/products/[id]/page.tsx", "utf8");
  assert.match(page, /사용 영상·가이드 검수/);
  assert.match(page, /getAdminProductUsageMediaReview/);
  assert.match(page, /noopener noreferrer/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(page, /<iframe/i);
  assert.doesNotMatch(page, /autoPlay|autoplay/);

  const rankSrc = await readFile("src/lib/recommend/rankProducts.ts", "utf8");
  assert.doesNotMatch(
    rankSrc,
    /isUsageMediaDisplayEligible|catalog_product_media/
  );

  const rec: Recommendation = {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Panthenol"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const p1: RankableProduct = {
    id: "1",
    brand: "COSRX",
    key_ingredients: ["Panthenol"],
  };
  const p2 = {
    ...p1,
    id: "2",
    has_usage_media: true,
  } as RankableProduct & { has_usage_media: boolean };
  const ranked = rankProducts(rec, [p1, p2]);
  assert.equal(ranked[0]!.score, ranked[1]!.score);

  console.log("admin usage media review self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

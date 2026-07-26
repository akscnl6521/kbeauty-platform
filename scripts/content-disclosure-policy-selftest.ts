import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateContentDisclosure,
  mapCatalogSourceTypeToRelationship,
  deriveUsageMediaRelationship,
} from "../src/lib/media/contentDisclosurePolicy";
import { decideUsageMediaPublication } from "../src/lib/media/productUsageMediaPolicy";
import { isUsageMediaDisplayEligible } from "../src/lib/media/isUsageMediaDisplayEligible";
import { evaluateCatalogProductMediaDisplay } from "../src/lib/admin/product-usage-media-eligibility";
import { parseVerifiedUsageGuide } from "../src/components/usage/ProductUsageGuide";
import { rankProducts } from "../src/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "../src/lib/recommend/types";
import type { UsageMediaAsset } from "../src/lib/media/productUsageMediaPolicy";

async function main() {
  const organic = evaluateContentDisclosure({ relationship: "organic" });
  assert.equal(organic.requiresDisclosure, false);
  assert.equal(organic.eligible, true);
  assert.equal(organic.disclosureLabel, null);

  const aiOk = evaluateContentDisclosure({
    relationship: "ai_generated",
    disclosureText:
      "AI 생성 콘텐츠입니다. 실제 사용 결과나 임상 효과처럼 오해되지 않도록 참고용으로만 보세요.",
  });
  assert.equal(aiOk.eligible, true);
  assert.equal(aiOk.requiresDisclosure, true);
  assert.match(aiOk.disclosureLabel ?? "", /AI/);

  const aiMissing = evaluateContentDisclosure({
    relationship: "ai_generated",
    disclosureText: null,
  });
  assert.equal(aiMissing.eligible, false);
  assert.ok(aiMissing.reasonCodes.includes("disclosure_missing"));

  const sponsoredOk = evaluateContentDisclosure({
    relationship: "sponsored",
    disclosureText: "협찬이 포함되어 있습니다.",
    sponsorName: "테스트",
  });
  assert.equal(sponsoredOk.eligible, true);

  const sponsoredMissing = evaluateContentDisclosure({
    relationship: "sponsored",
    disclosureText: null,
    sponsorName: null,
  });
  assert.equal(sponsoredMissing.eligible, false);
  assert.ok(sponsoredMissing.reasonCodes.includes("disclosure_missing"));

  const adOk = evaluateContentDisclosure({
    relationship: "advertisement",
    disclosureText: "광고입니다.",
  });
  assert.equal(adOk.eligible, true);
  assert.match(adOk.disclosureLabel ?? "", /광고|Advertisement/);

  const brand = evaluateContentDisclosure({ relationship: "brand_provided" });
  assert.equal(brand.eligible, true);
  assert.match(brand.disclosureLabel ?? "", /브랜드|Brand/);

  const affiliate = evaluateContentDisclosure({ relationship: "affiliate" });
  assert.equal(affiliate.eligible, true);
  assert.match(affiliate.disclosureText ?? "", /수수료|commission/i);

  const mismatch = evaluateContentDisclosure({
    relationship: "ai_generated",
    declaredRelationship: "sponsored",
    disclosureText: "AI 생성 콘텐츠입니다.",
  });
  assert.equal(mismatch.eligible, false);
  assert.ok(mismatch.reasonCodes.includes("disclosure_type_mismatch"));

  const httpBlocked = evaluateContentDisclosure({
    relationship: "organic",
    sourceUrl: "http://cdn.example.com/a.mp4",
  });
  assert.equal(httpBlocked.eligible, false);
  assert.ok(httpBlocked.reasonCodes.includes("https_required"));

  const expired = evaluateContentDisclosure({
    relationship: "organic",
    rightsNotExpired: false,
  });
  assert.equal(expired.eligible, false);
  assert.ok(expired.reasonCodes.includes("rights_expired"));

  assert.equal(mapCatalogSourceTypeToRelationship("official_brand"), "organic");
  assert.equal(mapCatalogSourceTypeToRelationship("ai_generated"), "ai_generated");
  assert.equal(
    deriveUsageMediaRelationship({ isSponsored: true }),
    "sponsored"
  );

  const baseAsset: UsageMediaAsset = {
    id: "m1",
    productId: "p1",
    mediaType: "video",
    sourceUrl: "https://cdn.example.com/a.mp4",
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
  assert.equal(isUsageMediaDisplayEligible(baseAsset).eligible, true);

  const catalogOfficial = evaluateCatalogProductMediaDisplay({
    productId: 1,
    imageUrl: "https://cdn.example.com/a.jpg",
    canonicalImageUrl: null,
    sourcePageUrl: "https://brand.example/p",
    sourceType: "official_brand",
    usageRightsStatus: "official_remote_use",
    validationStatus: "verified",
    verifiedAt: "2026-07-18T00:00:00Z",
    rightsNotes: null,
  });
  assert.equal(catalogOfficial.displayEligible, true);
  assert.equal(catalogOfficial.checklist.contentRelationship, "organic");
  assert.equal(catalogOfficial.checklist.disclosureRequired, false);

  const guideWithAiMedia = parseVerifiedUsageGuide(
    {
      productId: "p1",
      amountLabel: "완두콩",
      orderIndex: 1,
      frequency: "evening",
      applicationArea: ["얼굴"],
      methodSteps: ["바릅니다."],
      cautionText: [],
      verifiedAt: "2026-07-18T00:00:00.000Z",
      media: {
        mediaType: "video",
        sourceUrl: "https://cdn.example.com/a.mp4",
        contentRelationship: "ai_generated",
        disclosureText: null,
      },
    },
    "p1"
  );
  assert.equal(guideWithAiMedia?.media ?? null, null);

  const guideSponsored = parseVerifiedUsageGuide(
    {
      productId: "p1",
      amountLabel: "완두콩",
      orderIndex: 1,
      frequency: "evening",
      applicationArea: ["얼굴"],
      methodSteps: ["바릅니다."],
      cautionText: [],
      verifiedAt: "2026-07-18T00:00:00.000Z",
      media: {
        mediaType: "video",
        sourceUrl: "https://cdn.example.com/a.mp4",
        isSponsored: true,
        sponsorName: "테스트",
        disclosureText: "협찬이 포함되어 있습니다.",
      },
    },
    "p1"
  );
  assert.ok(guideSponsored?.media);
  assert.equal(guideSponsored?.media?.contentRelationship, "sponsored");

  const shared = await readFile(
    "src/components/usage/ProductUsageGuide.tsx",
    "utf8"
  );
  assert.match(shared, /ContentDisclosure/);
  assert.match(shared, /evaluateContentDisclosure/);
  assert.doesNotMatch(shared, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(shared, /autoPlay|autoplay/);
  assert.doesNotMatch(shared, /<iframe/i);

  const disclosureUi = await readFile(
    "src/components/disclosure/ContentDisclosure.tsx",
    "utf8"
  );
  assert.match(disclosureUi, /getContentDisclosureLabel/);
  assert.doesNotMatch(disclosureUi, /dangerouslySetInnerHTML/);

  const adminPage = await readFile(
    "src/app/admin/products/[id]/page.tsx",
    "utf8"
  );
  assert.match(adminPage, /콘텐츠 관계 \(disclosure\)/);
  assert.match(adminPage, /contentRelationship/);

  const policySrc = await readFile(
    "src/lib/media/productUsageMediaPolicy.ts",
    "utf8"
  );
  assert.match(policySrc, /evaluateContentDisclosure/);

  const rankSrc = await readFile("src/lib/recommend/rankProducts.ts", "utf8");
  assert.doesNotMatch(
    rankSrc,
    /evaluateContentDisclosure|ContentDisclosure|isSponsored|affiliate/
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
    content_relationship: "sponsored",
  } as RankableProduct & { content_relationship: string };
  const ranked = rankProducts(rec, [p1, p2]);
  assert.equal(ranked[0]!.score, ranked[1]!.score);

  const sponsoredDecision = decideUsageMediaPublication({
    ...baseAsset,
    isSponsored: true,
    sponsorName: "테스트 브랜드",
  });
  assert.equal(sponsoredDecision.publishable, true);
  assert.equal(sponsoredDecision.requiresDisclosure, true);

  console.log("content disclosure policy self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

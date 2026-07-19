import assert from "node:assert/strict";
import {
  decideUsageMediaPublication,
  validateUsageInstruction,
  type UsageMediaAsset,
} from "../src/lib/media/productUsageMediaPolicy";

const base: UsageMediaAsset = {
  id: "media-1",
  productId: "product-1",
  mediaType: "video",
  sourceUrl: null,
  storagePath: "product-usage/product-1/demo.mp4",
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

assert.equal(decideUsageMediaPublication(base, new Date("2026-07-19T00:00:00Z")).publishable, true);

const unknownRights = decideUsageMediaPublication({ ...base, rightsStatus: "unknown" });
assert.equal(unknownRights.publishable, false);
assert.ok(unknownRights.reasonCodes.includes("rights_not_publishable"));

const medicalClaim = decideUsageMediaPublication({ ...base, containsMedicalClaim: true });
assert.equal(medicalClaim.publishable, false);
assert.ok(medicalClaim.reasonCodes.includes("medical_claim_requires_rejection"));

const sponsored = decideUsageMediaPublication({
  ...base,
  isSponsored: true,
  sponsorName: "테스트 브랜드",
});
assert.equal(sponsored.publishable, true);
assert.equal(sponsored.requiresDisclosure, true);
assert.match(sponsored.disclosureText ?? "", /유료 광고/);

const expired = decideUsageMediaPublication(
  {
    ...base,
    rightsStatus: "licensed",
    consentReference: "license-2026-001",
    rightsExpiresAt: "2026-07-18T23:59:59Z",
  },
  new Date("2026-07-19T00:00:00Z")
);
assert.equal(expired.publishable, false);
assert.ok(expired.reasonCodes.includes("rights_expired"));

assert.deepEqual(
  validateUsageInstruction({
    productId: "product-1",
    amountLabel: "완두콩 1개 크기",
    orderIndex: 3,
    frequency: "evening",
    applicationArea: ["얼굴"],
    methodSteps: ["얼굴에 점을 찍듯 나눠 바릅니다.", "바깥쪽으로 부드럽게 펴 바릅니다."],
    cautionText: ["자극이 느껴지면 사용을 중단합니다."],
    sourceType: "official_brand",
    sourceUrl: "https://brand.example/product-1",
    verifiedAt: "2026-07-19T00:00:00Z",
  }),
  []
);

console.log("product usage media policy self-test: ok");

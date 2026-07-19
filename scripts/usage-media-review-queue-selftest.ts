import assert from "node:assert/strict";
import { buildUsageMediaReviewQueue } from "../src/lib/media/usageMediaReviewQueue";
import type { UsageMediaAsset } from "../src/lib/media/productUsageMediaPolicy";

const base: UsageMediaAsset = {
  id: "base",
  productId: "product-1",
  mediaType: "video",
  sourceUrl: "https://brand.example/video.mp4",
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

const now = new Date("2026-07-19T00:00:00Z");
const queue = buildUsageMediaReviewQueue(
  [
    { ...base, id: "safe" },
    { ...base, id: "revoked", rightsStatus: "revoked" },
    { ...base, id: "expired", rightsStatus: "licensed", consentReference: "license-1", rightsExpiresAt: "2026-07-18T00:00:00Z" },
    { ...base, id: "soon", rightsStatus: "licensed", consentReference: "license-2", rightsExpiresAt: "2026-08-01T00:00:00Z" },
    { ...base, id: "unknown", rightsStatus: "unknown" },
    { ...base, id: "missing-proof", rightsStatus: "brand_permission" },
    { ...base, id: "medical", containsMedicalClaim: true },
    { ...base, id: "sponsored", isSponsored: true },
  ],
  now,
);

assert.equal(queue.some((item) => item.mediaId === "safe"), false);
assert.equal(queue[0]?.priority, "critical");
assert.equal(queue.find((item) => item.mediaId === "revoked")?.action, "unpublish");
assert.ok(queue.find((item) => item.mediaId === "expired")?.reasons.includes("rights_expired"));
assert.equal(queue.find((item) => item.mediaId === "soon")?.action, "renew_rights");
assert.equal(queue.find((item) => item.mediaId === "soon")?.priority, "high");
assert.ok(queue.find((item) => item.mediaId === "missing-proof")?.reasons.includes("rights_evidence_missing"));
assert.ok(queue.find((item) => item.mediaId === "medical")?.reasons.includes("medical_claim"));
assert.ok(queue.find((item) => item.mediaId === "sponsored")?.reasons.includes("sponsorship_disclosure_missing"));

console.log("usage media review queue self-test: ok");

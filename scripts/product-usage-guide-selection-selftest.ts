import assert from "node:assert/strict";
import { selectProductUsageGuide } from "../src/lib/media/selectProductUsageMedia";
import type {
  UsageInstruction,
  UsageMediaAsset,
} from "../src/lib/media/productUsageMediaPolicy";

const baseMedia: UsageMediaAsset = {
  id: "video-1",
  productId: "product-1",
  mediaType: "video",
  sourceUrl: "https://brand.example/product-1-demo.mp4",
  storagePath: null,
  rightsStatus: "brand_permission",
  rightsExpiresAt: null,
  consentReference: "brand-permission-001",
  reviewStatus: "approved",
  productMatchVerified: true,
  applicationDemonstrationVerified: true,
  containsMedicalClaim: false,
  containsBeforeAfter: false,
  isSponsored: true,
  sponsorName: "테스트 브랜드",
  disclosureText: null,
  locale: "ko-KR",
};

const instruction: UsageInstruction = {
  productId: "product-1",
  amountLabel: "완두콩 1개 크기",
  orderIndex: 2,
  frequency: "evening",
  applicationArea: ["얼굴"],
  methodSteps: ["얼굴에 나누어 올립니다.", "바깥쪽으로 부드럽게 펴 바릅니다."],
  cautionText: ["자극이 느껴지면 사용을 중단합니다."],
  sourceType: "official_brand",
  sourceUrl: "https://brand.example/product-1",
  verifiedAt: "2026-07-19T00:00:00Z",
};

const guide = selectProductUsageGuide(
  "product-1",
  [
    { ...baseMedia, id: "image-1", mediaType: "image" },
    baseMedia,
    { ...baseMedia, id: "rejected", reviewStatus: "rejected" },
  ],
  [instruction],
  new Date("2026-07-19T00:00:00Z")
);

assert.equal(guide.media?.id, "video-1");
assert.equal(guide.instruction?.amountLabel, "완두콩 1개 크기");
assert.match(guide.disclosureText ?? "", /유료 광고/);

const empty = selectProductUsageGuide(
  "product-2",
  [{ ...baseMedia, productId: "product-2", rightsStatus: "unknown" }],
  [{ ...instruction, productId: "product-2", amountLabel: "" }]
);
assert.equal(empty.media, null);
assert.equal(empty.instruction, null);

console.log("product usage guide selection self-test: ok");

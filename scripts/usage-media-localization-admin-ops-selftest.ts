/**
 * T05 — Usage media localization + admin ops self-test.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildUsageGuidanceComplete,
  presentUsageGuidance,
  resolveApplicationVideo,
  validatePatchTestGuidance,
} from "../src/lib/media/usageGuidanceComplete";
import type {
  UsageInstruction,
  UsageMediaAsset,
} from "../src/lib/media/productUsageMediaPolicy";
import { presentLocalizedOffers } from "../src/lib/commerce/localizedOffers";
import type { ProductOffer } from "../src/lib/recommend/catalogTypes";
import {
  applyAdminOpsTransition,
  applyDuplicateMerge,
  buildAdminOpsSummary,
  canTransition,
  getStaleRefreshQueue,
  listAdminOpsAuditTrail,
  reviewEvidence,
  resetAdminOpsStore,
  seedAdminOpsFixtures,
} from "../src/lib/catalog/adminOps";

const root = process.cwd();

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `missing: ${rel}`);
}

const now = new Date("2026-07-23T12:00:00.000Z");

const instruction: UsageInstruction = {
  productId: "p-1",
  amountLabel: "완두콩 크기",
  orderIndex: 2,
  frequency: "evening",
  applicationArea: ["face"],
  methodSteps: ["세안 후", "가볍게 펴 바르기"],
  cautionText: ["눈에 들어가지 않게 하세요"],
  sourceType: "official_brand",
  sourceUrl: "https://brand.example/how-to",
  verifiedAt: "2026-07-20T00:00:00.000Z",
};

const approvedVideo: UsageMediaAsset = {
  id: "m-1",
  productId: "p-1",
  mediaType: "video",
  sourceUrl: "https://cdn.example/howto.mp4",
  storagePath: null,
  rightsStatus: "owned",
  rightsExpiresAt: "2027-01-01T00:00:00.000Z",
  consentReference: null,
  reviewStatus: "approved",
  productMatchVerified: true,
  applicationDemonstrationVerified: true,
  containsMedicalClaim: false,
  containsBeforeAfter: false,
  isSponsored: false,
  sponsorName: null,
  disclosureText: null,
  locale: "ko",
};

// --- Usage guidance metadata + fallbacks ---
assert.deepEqual(validatePatchTestGuidance(null), ["patch_test_missing"]);
assert.ok(
  validatePatchTestGuidance({
    recommended: true,
    waitHours: 24,
    steps: ["팔 안쪽에 소량"],
    sourceUrl: "https://brand.example/patch",
    verifiedAt: "2026-07-20T00:00:00.000Z",
  }).length === 0,
);

const complete = buildUsageGuidanceComplete({
  instruction,
  locale: "ko",
  countryCode: "KR",
  patchTest: {
    recommended: true,
    waitHours: 24,
    steps: ["팔 안쪽에 소량"],
    sourceUrl: "https://brand.example/patch",
    verifiedAt: "2026-07-20T00:00:00.000Z",
  },
  applicationVideoAsset: approvedVideo,
  now,
});
const presented = presentUsageGuidance(complete, { preferredLocale: "ko" });
assert.equal(presented.fallbackState, "complete");
assert.equal(presented.messageKey, "ok");
assert.equal(presented.videoEligible, true);
assert.equal(presented.patchTestEligible, true);

const textOnly = buildUsageGuidanceComplete({
  instruction,
  locale: "en",
  patchTest: null,
  applicationVideoAsset: null,
  now,
});
const partial = presentUsageGuidance(textOnly);
assert.equal(partial.fallbackState, "partial_text_only");
assert.equal(partial.textGuideEligible, true);
assert.equal(partial.videoEligible, false);
assert.equal(partial.messageKey, "partial_guide");

const badVideo = resolveApplicationVideo(
  { ...approvedVideo, reviewStatus: "draft", sourceUrl: null },
  now,
);
assert.equal(badVideo.publishable, false);
assert.ok(badVideo.reasonCodes.includes("media_not_approved"));

const empty = presentUsageGuidance(null);
assert.equal(empty.fallbackState, "empty");
assert.equal(empty.messageKey, "guide_unavailable");

// --- Localized offers: never invent inventory ---
const offers: ProductOffer[] = [
  {
    id: "o-kr",
    productId: "p-1",
    retailerName: "Official KR",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    purchaseUrl: "https://shop.example/kr",
    price: 28000,
    currency: "KRW",
    stockStatus: "in_stock",
    verificationStatus: "verified",
    isOfficial: true,
    verifiedAt: "2026-07-20T00:00:00.000Z",
    lastCheckedAt: "2026-07-22T00:00:00.000Z",
    active: true,
  },
];

const kr = presentLocalizedOffers({
  offers,
  shippingCountry: "KR",
  locale: "ko",
});
assert.equal(kr.inventedInventory, false);
assert.equal(kr.offers.length, 1);
assert.equal(kr.preferred?.priceLabel?.includes("28"), true);
assert.equal(kr.emptyReason, null);

const jp = presentLocalizedOffers({
  offers,
  shippingCountry: "JP",
  locale: "ja",
});
assert.equal(jp.regionUnavailable, true);
assert.equal(jp.offers.length, 0);
assert.equal(jp.inventedInventory, false);
assert.equal(jp.emptyReason, "region_unavailable");

const none = presentLocalizedOffers({
  offers: [],
  shippingCountry: "KR",
  locale: "en",
});
assert.equal(none.emptyReason, "no_offers");
assert.equal(none.offers.length, 0);

const unverified = presentLocalizedOffers({
  offers: [
    {
      ...offers[0]!,
      id: "o-u",
      verificationStatus: "unverified",
    },
  ],
  shippingCountry: "KR",
  locale: "en",
});
assert.equal(unverified.preferred?.purchaseUrl, null);

// --- Admin ops: review / merge / evidence / transitions / stale / retry / audit ---
resetAdminOpsStore();
seedAdminOpsFixtures(now);
const summary = buildAdminOpsSummary();
assert.ok(summary.total >= 4);
assert.equal(summary.productionTouched, false);
assert.equal(summary.stagingWriteAllowed, false);

assert.equal(canTransition("candidate", "start_review"), true);
assert.equal(canTransition("merged_away", "approve_staging"), false);

const started = applyAdminOpsTransition("cand-usage-1", "start_review", {
  mode: "local",
  now,
});
assert.equal(started.ok, true);
assert.equal(started.candidate?.reviewStatus, "in_review");
assert.equal(started.stagingWritePerformed, false);

const evidenceOk = reviewEvidence("cand-media-1", "ev-2", true, now);
assert.equal(evidenceOk.ok, true);
assert.equal(
  evidenceOk.candidate?.evidence.find((e) => e.id === "ev-2")?.verified,
  true,
);

const blockedApprove = applyAdminOpsTransition("cand-media-dup", "approve_staging", {
  mode: "staging_dry_run",
  now,
});
assert.equal(blockedApprove.ok, false);

const merge = applyDuplicateMerge("cand-media-1", ["cand-media-dup"], now);
assert.equal(merge.ok, true);
assert.ok(merge.mergedIds.includes("cand-media-dup"));

const stale = getStaleRefreshQueue(now);
assert.ok(stale.some((item) => item.candidateId === "cand-offer-jp"));
assert.ok(stale.some((item) => item.priority === "critical"));

const retry = applyAdminOpsTransition("cand-offer-jp", "queue_retry", {
  mode: "staging_dry_run",
  now,
});
assert.equal(retry.ok, true);
assert.equal(retry.candidate?.reviewStatus, "retry_queued");
assert.ok((retry.candidate?.retryCount ?? 0) >= 3);

const audit = listAdminOpsAuditTrail(50);
assert.ok(audit.length >= 3);
assert.ok(audit.every((e) => e.productionTouched === false));
assert.ok(audit.every((e) => e.databaseTouched === false));

// --- Path / UI wiring ---
mustExist("src/lib/media/usageGuidanceComplete.ts");
mustExist("src/lib/commerce/localizedOffers.ts");
mustExist("src/lib/catalog/adminOps/index.ts");
mustExist("src/app/admin/catalog/ops/page.tsx");
mustExist("src/app/api/admin/catalog-ops/route.ts");
mustExist("docs/usage-media-localization-admin-ops.md");

const guideUi = readFileSync(
  path.join(root, "src/components/usage/ProductUsageGuide.tsx"),
  "utf8",
);
assert.match(guideUi, /patchTest/);
assert.match(guideUi, /presentUsageGuidance/);
assert.match(guideUi, /data-usage-fallback/);
assert.doesNotMatch(guideUi, /autoPlay|autoplay/);

const subnav = readFileSync(
  path.join(root, "src/app/admin/AdminSubnav.tsx"),
  "utf8",
);
assert.match(subnav, /catalog\/ops/);

const pkg = readFileSync(path.join(root, "package.json"), "utf8");
assert.match(pkg, /test:usage-media-admin-ops/);

console.log("usage media localization + admin ops self-test: ok");

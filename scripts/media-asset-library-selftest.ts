/**
 * Pure-logic assertions for the §36.4 media asset library domain layer.
 * Offline: no DB, no network.
 */
import assert from "node:assert/strict";
import {
  buildMediaReviewChecklist,
  decideMediaAssetPublication,
  evaluateRightsWindow,
  findExpiringRights,
  isMediaAssetType,
  isMediaSourceType,
  isRoutineVideoContext,
  rightsCoverTerritory,
  type MediaAssetRecord,
  type MediaRightsRecord,
} from "../src/lib/media/mediaAssetLibrary";

const NOW = new Date("2026-07-27T00:00:00.000Z");

function asset(overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord {
  return {
    id: "asset-1",
    assetType: "category_usage",
    mediaType: "video",
    scope: "category_common",
    sourceType: "official_brand",
    sourceUrl: "https://www.youtube.com/watch?v=example",
    sourcePageUrl: null,
    storageUrl: null,
    embedProvider: "youtube",
    embedId: "example",
    title: "클렌저 공통 도포법",
    language: "ko",
    country: "KR",
    durationSeconds: 45,
    routineStep: "cleanser",
    timeOfDay: "am_pm",
    categorySlug: "cleanser",
    concernTags: [],
    bodyAreaTags: ["face"],
    contentRelationship: "organic",
    disclosure: null,
    isSponsored: false,
    sponsorName: null,
    isAiGenerated: false,
    containsMedicalClaim: false,
    containsBeforeAfter: false,
    showsProductName: false,
    verificationStatus: "approved",
    verifiedAt: "2026-07-27T00:00:00.000Z",
    isAccessible: true,
    ...overrides,
  };
}

function rights(overrides: Partial<MediaRightsRecord> = {}): MediaRightsRecord {
  return {
    id: "rights-1",
    mediaAssetId: "asset-1",
    rightsStatus: "embed_only",
    rightsBasis: "YouTube 표준 임베드 약관",
    rightsHolder: "Brand Official Channel",
    allowsEmbed: true,
    allowsCopy: false,
    allowsDownload: false,
    allowsModification: false,
    rightsStartAt: "2026-07-01T00:00:00.000Z",
    rightsEndAt: "2027-07-01T00:00:00.000Z",
    isWorldwide: false,
    territoryCodes: ["KR"],
    evidenceUrl: "https://www.youtube.com/t/terms",
    reviewDueAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

// --- rights window -----------------------------------------------------------
assert.equal(evaluateRightsWindow(rights(), NOW), "active", "in-window grant");
assert.equal(
  evaluateRightsWindow(rights({ rightsEndAt: "2026-07-01T00:00:00.000Z" }), NOW),
  "expired",
  "past end date"
);
assert.equal(
  evaluateRightsWindow(rights({ rightsStartAt: "2026-08-01T00:00:00.000Z" }), NOW),
  "not_started",
  "future start date"
);
assert.equal(
  evaluateRightsWindow(rights({ rightsStatus: "unknown" }), NOW),
  "dead",
  "unknown rights are never usable"
);
assert.equal(
  evaluateRightsWindow(rights({ rightsStatus: "revoked" }), NOW),
  "dead",
  "revoked rights are never usable"
);
assert.equal(
  evaluateRightsWindow(rights({ rightsEndAt: "not-a-date" }), NOW),
  "dead",
  "unparseable end date fails closed"
);
assert.equal(
  evaluateRightsWindow(rights({ rightsStartAt: null, rightsEndAt: null }), NOW),
  "active",
  "open-ended grant"
);

// --- territory ---------------------------------------------------------------
assert.equal(rightsCoverTerritory(rights(), "KR"), true, "listed territory");
assert.equal(rightsCoverTerritory(rights(), "kr"), true, "case-insensitive");
assert.equal(rightsCoverTerritory(rights(), "JP"), false, "unlisted territory");
assert.equal(rightsCoverTerritory(rights(), null), false, "no country = no match");
assert.equal(
  rightsCoverTerritory(rights({ isWorldwide: true }), null),
  true,
  "worldwide covers everything"
);

// --- publication decision ----------------------------------------------------
const happy = decideMediaAssetPublication(asset(), [rights()], {
  now: NOW,
  countryCode: "KR",
});
assert.equal(happy.publishable, true, "clean official embed is publishable");
assert.deepEqual(happy.reasonCodes, [], "no reasons on the happy path");
assert.equal(happy.rightsWindow, "active", "window reported active");
assert.equal(happy.requiresDisclosure, false, "organic needs no disclosure");

const noRights = decideMediaAssetPublication(asset(), [], {
  now: NOW,
  countryCode: "KR",
});
assert.equal(noRights.publishable, false, "no rights row blocks display");
assert.ok(
  noRights.reasonCodes.includes("rights_record_missing"),
  "missing rights reported"
);

const expired = decideMediaAssetPublication(
  asset(),
  [rights({ rightsEndAt: "2026-07-01T00:00:00.000Z" })],
  { now: NOW, countryCode: "KR" }
);
assert.equal(expired.publishable, false, "expired rights block display");
assert.ok(expired.reasonCodes.includes("rights_expired"), "expiry reported");
assert.equal(expired.rightsWindow, "expired", "window reported expired");

const wrongTerritory = decideMediaAssetPublication(asset(), [rights()], {
  now: NOW,
  countryCode: "JP",
});
assert.equal(wrongTerritory.publishable, false, "territory mismatch blocks");
assert.ok(
  wrongTerritory.reasonCodes.includes("territory_not_covered"),
  "territory reported"
);

const noEmbed = decideMediaAssetPublication(
  asset(),
  [rights({ allowsEmbed: false })],
  { now: NOW, countryCode: "KR" }
);
assert.equal(noEmbed.publishable, false, "embed must be permitted");
assert.ok(
  noEmbed.reasonCodes.includes("embed_not_permitted"),
  "embed permission reported"
);

// §36.3 — an unauthorized copy of an external video is never publishable
const copied = decideMediaAssetPublication(
  asset({ storageUrl: "https://cdn.example.com/copy.mp4" }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(copied.publishable, false, "copied brand video blocked");
assert.ok(
  copied.reasonCodes.includes("unauthorized_copy"),
  "unauthorized copy reported"
);

// our own footage may be stored, when a grant allows the copy
const ownCopy = decideMediaAssetPublication(
  asset({
    sourceType: "platform_original",
    sourceUrl: null,
    storageUrl: "https://cdn.example.com/own.mp4",
    embedProvider: "self_hosted",
    embedId: "own",
  }),
  [rights({ rightsStatus: "owned", allowsCopy: true, allowsDownload: true })],
  { now: NOW, countryCode: "KR" }
);
assert.equal(ownCopy.publishable, true, "own footage with copy grant is fine");

const ownCopyNoGrant = decideMediaAssetPublication(
  asset({
    sourceType: "platform_original",
    sourceUrl: null,
    storageUrl: "https://cdn.example.com/own.mp4",
    embedProvider: "self_hosted",
    embedId: "own",
  }),
  [rights({ rightsStatus: "embed_only", allowsCopy: false })],
  { now: NOW, countryCode: "KR" }
);
assert.equal(ownCopyNoGrant.publishable, false, "storing needs a copy grant");
assert.ok(
  ownCopyNoGrant.reasonCodes.includes("copy_not_permitted"),
  "copy permission reported"
);

// review lifecycle
const pending = decideMediaAssetPublication(
  asset({ verificationStatus: "needs_review", verifiedAt: null }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(pending.publishable, false, "unreviewed asset is not publishable");
assert.ok(
  pending.reasonCodes.includes("media_not_approved"),
  "review status reported"
);

const unreachable = decideMediaAssetPublication(
  asset({ isAccessible: false }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(unreachable.publishable, false, "dead URL blocks display");
assert.ok(
  unreachable.reasonCodes.includes("media_unreachable"),
  "reachability reported"
);

// content safety
const medical = decideMediaAssetPublication(
  asset({ containsMedicalClaim: true }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(medical.publishable, false, "medical claim blocks display");
assert.ok(
  medical.reasonCodes.includes("medical_claim_forbidden"),
  "medical claim reported"
);

const namedProduct = decideMediaAssetPublication(
  asset({ showsProductName: true }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(
  namedProduct.publishable,
  false,
  "category-common asset must not name a product"
);
assert.ok(
  namedProduct.reasonCodes.includes("category_common_must_not_name_product"),
  "product-name rule reported"
);

// disclosure
const sponsoredNoText = decideMediaAssetPublication(
  asset({
    isSponsored: true,
    contentRelationship: "sponsored",
    disclosure: null,
    sponsorName: null,
  }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(sponsoredNoText.publishable, false, "sponsorship needs disclosure");
assert.ok(
  sponsoredNoText.reasonCodes.includes("sponsorship_disclosure_missing"),
  "sponsorship disclosure reported"
);

const sponsoredWithText = decideMediaAssetPublication(
  asset({
    isSponsored: true,
    contentRelationship: "sponsored",
    disclosure: "브랜드 협찬을 받은 콘텐츠입니다.",
    sponsorName: "Brand",
  }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(sponsoredWithText.publishable, true, "disclosed sponsorship passes");
assert.equal(
  sponsoredWithText.requiresDisclosure,
  true,
  "sponsorship still flagged as requiring disclosure"
);
assert.equal(sponsoredWithText.disclosureLabel, "협찬", "Korean sponsor label");

const aiUndisclosed = decideMediaAssetPublication(
  asset({ isAiGenerated: true, contentRelationship: "organic" }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(aiUndisclosed.publishable, false, "AI content must be declared");
assert.ok(
  aiUndisclosed.reasonCodes.includes("ai_disclosure_missing"),
  "AI disclosure reported"
);

// transport
const httpSource = decideMediaAssetPublication(
  asset({ sourceUrl: "http://insecure.example.com/v" }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(httpSource.publishable, false, "http source blocked");
assert.ok(httpSource.reasonCodes.includes("https_required"), "https reported");

const noLocator = decideMediaAssetPublication(
  asset({ sourceUrl: null, storageUrl: null, embedProvider: "none", embedId: null }),
  [rights()],
  { now: NOW, countryCode: "KR" }
);
assert.equal(noLocator.publishable, false, "asset with no locator blocked");
assert.ok(
  noLocator.reasonCodes.includes("media_source_missing"),
  "missing locator reported"
);

// --- reviewer checklist ------------------------------------------------------
const checklist = buildMediaReviewChecklist(asset(), [rights()], NOW);
assert.deepEqual(
  checklist,
  {
    httpsSource: true,
    officialSource: true,
    rightsRecorded: true,
    rightsWindowActive: true,
    rightsEvidencePresent: true,
    copyLegal: true,
    disclosureSatisfied: true,
    noMedicalClaim: true,
    categoryCommonClean: true,
    reachable: true,
  },
  "clean asset checklist is all green"
);

const badChecklist = buildMediaReviewChecklist(
  asset({ storageUrl: "https://cdn.example.com/copy.mp4", containsMedicalClaim: true }),
  [rights({ rightsEndAt: "2026-07-01T00:00:00.000Z", evidenceUrl: null })],
  NOW
);
assert.equal(badChecklist.copyLegal, false, "copy flagged");
assert.equal(badChecklist.noMedicalClaim, false, "medical claim flagged");
assert.equal(badChecklist.rightsWindowActive, false, "expired window flagged");
assert.equal(badChecklist.rightsEvidencePresent, false, "missing evidence flagged");

// --- expiry sweep ------------------------------------------------------------
const expiring = findExpiringRights(
  [
    rights({ id: "r-soon", rightsEndAt: "2026-08-10T00:00:00.000Z" }),
    rights({ id: "r-later", rightsEndAt: "2027-01-01T00:00:00.000Z" }),
    rights({ id: "r-open", rightsEndAt: null }),
    rights({ id: "r-past", rightsEndAt: "2026-07-01T00:00:00.000Z" }),
  ],
  30,
  NOW
);
assert.deepEqual(
  expiring.map((grant) => grant.id),
  ["r-soon"],
  "only grants expiring inside the horizon are returned"
);

// --- guards ------------------------------------------------------------------
assert.equal(isMediaAssetType("category_usage"), true);
assert.equal(isMediaAssetType("nope"), false);
assert.equal(isMediaSourceType("official_brand"), true);
assert.equal(isMediaSourceType("random_blog"), false, "unlisted source rejected");
assert.equal(isRoutineVideoContext("am_routine"), true);
assert.equal(isRoutineVideoContext("morning"), false);

console.log("[media-asset-library] domain self-test: ok");

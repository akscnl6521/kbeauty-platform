/**
 * T04 — Organic commerce + professional routing self-test.
 * Verifies ranking/API contracts/persistence/labels/analytics/admin +
 * symptom professional routing / general vs partnered / fixture block.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  assertOrganicOrderUnchanged,
  buildCommercialPresentation,
  type CommercialCandidate,
} from "../src/lib/commercial/commercialSeparationPolicy";
import {
  createAffiliateLinkDraft,
  stripPaidFieldsForOrganicScore,
  validateAffiliateLink,
  ORGANIC_SCORE_FORBIDDEN_FIELDS,
} from "../src/lib/commercial/affiliateLink";
import {
  assertPaidFieldsDoNotAlterOrganicOrder,
  buildOrganicCommercePresentation,
  findForbiddenPaidKeysInScorePayload,
  rankByOrganicScoreOnly,
  type OrganicRankInput,
} from "../src/lib/commercial/organicRanking";
import {
  assertSponsoredNotInOrganicLane,
  resolveAdSlot,
} from "../src/lib/commercial/adSlotPolicy";
import {
  findHealthTargetingKeys,
  recordCommerceEvent,
  resetCommerceAnalyticsStore,
  summarizeCommerceAnalytics,
  validateCommerceEvent,
} from "../src/lib/commercial/commerceAnalytics";
import {
  advanceAffiliateReview,
  buildAffiliateAdminSummary,
  resetAffiliateLinkStore,
  upsertAffiliateLink,
} from "../src/lib/commercial/commerceStore";
import { COMMERCE_LANE_LABELS_KO } from "../src/lib/commercial/commerceLabels";
import {
  assertNoFixtureInPublishableLanes,
  buildProfessionalGuidanceBundle,
} from "../src/lib/care/professionalGuidanceBundle";
import { routeProfessionalGuidance } from "../src/lib/care/professionalRouting";
import { isClinicPublishable } from "../src/lib/clinic/clinicVerification";
import { buildFixtureClinicCandidates } from "../src/lib/clinic/clinicCollection";

const root = process.cwd();

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `missing: ${rel}`);
}

function baseCommercial(
  overrides: Partial<OrganicRankInput["commercial"]> = {},
): OrganicRankInput["commercial"] {
  return {
    organicRank: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureLabel: null,
    partner: null,
    commissionType: null,
    campaignId: null,
    sponsoredPlacement: null,
    affiliateUrl: null,
    affiliateVerifiedAt: null,
    ...overrides,
  };
}

// --- Affiliate link structure ---
const draft = createAffiliateLinkDraft({
  id: "aff-1",
  entityType: "product",
  entityId: "p1",
  affiliateUrl: "https://shop.example/a",
  isAffiliate: true,
  isSponsored: false,
  disclosureLabel: "제휴 수수료가 발생할 수 있습니다.",
  partner: null,
  commissionType: "cps",
  campaignId: null,
  sponsoredPlacement: null,
  affiliateVerifiedAt: "2026-07-23T00:00:00Z",
  organicRank: 80,
  evidenceVerified: true,
});
assert.equal(validateAffiliateLink(draft).ok, true);
assert.ok(ORGANIC_SCORE_FORBIDDEN_FIELDS.includes("campaignSpend"));

const stripped = stripPaidFieldsForOrganicScore({
  organicScore: 90,
  isAffiliate: true,
  campaignSpend: 1000,
  matchReasons: ["barrier"],
});
assert.equal("isAffiliate" in stripped, false);
assert.equal("campaignSpend" in stripped, false);
assert.equal(stripped.organicScore, 90);

// --- Organic ranking independent of paid noise ---
const baseRank: OrganicRankInput[] = [
  {
    id: "high",
    entityType: "product",
    organicScore: 95,
    commercial: baseCommercial(),
  },
  {
    id: "mid-aff",
    entityType: "product",
    organicScore: 70,
    commercial: baseCommercial({
      isAffiliate: true,
      affiliateUrl: "https://shop.example/m",
      disclosureLabel: "제휴",
      commissionType: "cps",
      affiliateVerifiedAt: "2026-07-20T00:00:00Z",
    }),
  },
  {
    id: "sponsored",
    entityType: "product",
    organicScore: 99,
    commercial: baseCommercial({
      isSponsored: true,
      partner: "Brand X",
      disclosureLabel: "유료 광고",
      affiliateUrl: "https://ad.example/x",
      campaignId: "c1",
      affiliateVerifiedAt: "2026-07-20T00:00:00Z",
    }),
  },
];

const noisyRank: OrganicRankInput[] = baseRank.map((item) => ({
  ...item,
  commercial: {
    ...item.commercial,
    campaignId: "noise-campaign",
    sponsoredPlacement: 1,
    partner: item.commercial.partner ?? "noise-partner",
  },
}));

assert.equal(assertPaidFieldsDoNotAlterOrganicOrder(baseRank, noisyRank), true);
const organicIds = rankByOrganicScoreOnly(baseRank).map((c) => c.id);
assert.deepEqual(organicIds, ["high", "mid-aff"]);
assert.ok(!organicIds.includes("sponsored"));

const presentation = buildOrganicCommercePresentation(baseRank);
assert.deepEqual(
  presentation.organic.map((c) => c.id),
  ["high", "mid-aff"],
);
assert.equal(presentation.sponsored.length, 1);
assert.equal(
  findForbiddenPaidKeysInScorePayload({ organicScore: 1, campaignSpend: 10 })
    .length > 0,
  true,
);

// Legacy policy still holds
const legacy: CommercialCandidate[] = presentation.organic;
assert.equal(assertOrganicOrderUnchanged(legacy, presentation.organic), true);
assert.ok(buildCommercialPresentation(legacy).organic.length >= 1);

// --- Ad slots ---
assert.equal(assertSponsoredNotInOrganicLane("organic_recommendation", "sponsored"), false);
assert.equal(assertSponsoredNotInOrganicLane("sponsored_rail", "sponsored"), true);
assert.equal(resolveAdSlot("urgent_safety").allowAffiliate, false);

// --- Analytics + health targeting ban ---
resetCommerceAnalyticsStore();
const banned = validateCommerceEvent({
  type: "click",
  lane: "affiliate",
  entityType: "product",
  entityId: "p1",
  targetingProfile: { skinConcerns: ["acne"], symptoms: ["pain"] },
});
assert.equal(banned.ok, false);
assert.ok(banned.reasons.includes("health_targeting_forbidden"));
assert.deepEqual(findHealthTargetingKeys({ skinConcerns: [] }), ["skinConcerns"]);

const okEvent = recordCommerceEvent({
  type: "click",
  lane: "affiliate",
  entityType: "product",
  entityId: "p1",
  campaignId: "c-aff",
});
assert.equal(okEvent.ok, true);
if (okEvent.ok) {
  assert.equal(okEvent.event.usedHealthTargeting, false);
  assert.equal(okEvent.event.databaseTouched, false);
}
assert.equal(summarizeCommerceAnalytics().clicks, 1);
assert.equal(summarizeCommerceAnalytics().healthTargetingClaims, 0);

// --- Persistence / admin summary ---
resetAffiliateLinkStore();
const saved = upsertAffiliateLink(draft);
assert.equal(saved.ok, true);
const reviewed = advanceAffiliateReview("aff-1", "mark_reviewed");
assert.equal(reviewed.ok, true);
const published = advanceAffiliateReview("aff-1", "mark_publishable");
assert.equal(published.ok, true);
const admin = buildAffiliateAdminSummary();
assert.equal(admin.publishable, 1);
assert.equal(admin.productionTouched, false);

// --- Professional routing + general vs partnered + fixture block ---
const allergy = routeProfessionalGuidance({ areas: ["allergy"] });
assert.equal(allergy[0]?.professionalType, "allergy_care");

const scalp = routeProfessionalGuidance({
  areas: ["hair_loss_scalp_inflammation"],
  severeInflammation: true,
});
assert.equal(scalp[0]?.professionalType, "hair_scalp_clinic");
assert.equal(scalp[0]?.productRecommendationAllowed, false);

const dental = routeProfessionalGuidance({ areas: ["oral_smile"] });
assert.equal(dental[0]?.professionalType, "dentistry");

const bundle = buildProfessionalGuidanceBundle({
  areas: ["redness_vascular"],
  languages: ["ko"],
  now: new Date("2026-07-23T00:00:00Z"),
});
assert.ok(bundle.routes.length > 0);
assert.equal(bundle.lanes.fixtureBlockedFromPublish, true);
assert.equal(assertNoFixtureInPublishableLanes(bundle), true);
assert.equal(bundle.clinics.publishableCount, 0);
assert.ok(bundle.clinics.demoPreview.every((c) => c.isDemo));
assert.ok(bundle.adSlots.organic.allowSponsored === false);
assert.match(bundle.disclosures.organicVsPartner, /Organic|제휴/);

const fixtures = buildFixtureClinicCandidates();
assert.equal(fixtures.filter(isClinicPublishable).length, 0);

// --- Path presence (API / UI / admin) ---
for (const rel of [
  "src/lib/commercial/affiliateLink.ts",
  "src/lib/commercial/organicRanking.ts",
  "src/lib/commercial/adSlotPolicy.ts",
  "src/lib/commercial/commerceAnalytics.ts",
  "src/lib/commercial/commerceStore.ts",
  "src/lib/commercial/commerceLabels.ts",
  "src/lib/care/professionalGuidanceBundle.ts",
  "src/app/api/commerce/presentation/route.ts",
  "src/app/api/commerce/events/route.ts",
  "src/app/api/admin/commerce/route.ts",
  "src/app/api/care/professional-guidance/route.ts",
  "src/app/admin/commerce/page.tsx",
  "src/components/commerce/CommerceLaneBadge.tsx",
  "src/components/commerce/SponsoredCard.tsx",
]) {
  mustExist(rel);
}

const panelSrc = readFileSync(
  "src/components/clinic/ClinicReferralPanel.tsx",
  "utf8",
);
assert.match(panelSrc, /CommerceLaneBadge/);
assert.match(panelSrc, /partner_clinic|demo_fixture/);

const cardSrc = readFileSync(
  "src/components/recommendation/RecommendedProductCard.tsx",
  "utf8",
);
assert.match(cardSrc, /CommerceLaneBadge/);
assert.match(cardSrc, /lane="organic"/);

const subnav = readFileSync("src/app/admin/AdminSubnav.tsx", "utf8");
assert.match(subnav, /\/admin\/commerce/);

assert.ok(COMMERCE_LANE_LABELS_KO.organic.includes("Organic"));

console.log("organic commerce + professional routing self-test: ok");

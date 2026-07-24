/**
 * P3-T04 Affiliate / sponsored revenue readiness self-test.
 * Fixture / dry-run only — proves no commercial activation and no invented rates/URLs.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ANALYTICS_PRIVACY_BOUNDARY,
  REVENUE_READINESS_TASK_ID,
  assertNoCommercialActivation,
  buildDisclosureContract,
  createAffiliateOfferFixtures,
  createClickConversionEventFixtures,
  createSponsoredPlacementFixtures,
  evaluateExpiry,
  ingestAffiliateOffer,
  ingestSponsoredPlacement,
  looksLikeOrganicReason,
  normalizeCommissionContract,
  proveOrganicAndProfessionalIndependence,
  runFixtureRevenueReadiness,
  runRevenueReadiness,
  selectCountryPurchaseLink,
  validateClickConversionEvent,
  validateCountryPurchaseLinks,
} from "../src/lib/commercial/revenueReadiness";

async function main() {
  assert.equal(REVENUE_READINESS_TASK_ID, "P3-T04");
  assert.equal(ANALYTICS_PRIVACY_BOUNDARY.healthTargetingAllowed, false);
  assert.equal(ANALYTICS_PRIVACY_BOUNDARY.symptomTargetingAllowed, false);

  const offers = createAffiliateOfferFixtures();
  const placements = createSponsoredPlacementFixtures();
  const events = createClickConversionEventFixtures();
  assert.ok(offers.length >= 5);
  assert.ok(placements.length >= 3);
  assert.ok(events.length >= 3);
  assert.ok(offers.every((o) => o.isFixture));

  // Commission safety — never invent rates
  const invented = normalizeCommissionContract({
    commissionType: "cps",
    commissionRatePercent: null,
    commissionRateKnown: true,
    commissionAmountKnown: false,
    commissionAmount: null,
    currency: null,
    inventedCommissionRate: true,
  });
  assert.ok(invented.reasons.includes("commission_rate_invented"));
  assert.equal(invented.commission.commissionRatePercent, null);
  assert.equal(invented.commission.commissionRateKnown, false);

  const unknownOk = normalizeCommissionContract({
    commissionType: "cps",
    commissionRatePercent: null,
    commissionRateKnown: false,
    commissionAmountKnown: false,
    commissionAmount: null,
    currency: null,
  });
  assert.equal(unknownOk.reasons.length, 0);
  assert.equal(unknownOk.commission.commissionRateKnown, false);

  // Disclosure
  assert.equal(looksLikeOrganicReason("유기적 추천 1위"), true);
  const goodDisclosure = buildDisclosureContract({
    lane: "affiliate",
    labelKo: null,
    labelEn: null,
  });
  assert.ok(goodDisclosure.disclosure);
  assert.equal(goodDisclosure.disclosure!.looksLikeOrganicReason, false);

  const badDisclosure = buildDisclosureContract({
    lane: "sponsored",
    labelKo: "유기적 추천 최고",
    labelEn: "Best organic recommendation",
  });
  assert.equal(badDisclosure.disclosure, null);
  assert.ok(
    badDisclosure.reasons.includes("disclosure_looks_like_organic_reason"),
  );

  // Country links
  const links = validateCountryPurchaseLinks(
    [
      {
        countryCode: "kr",
        languageCode: "ko",
        currency: "KRW",
        purchaseUrl: "https://shop.example.kr/item",
        shipsToCountry: true,
        inStock: true,
        verifiedAt: "2026-07-20T00:00:00.000Z",
        isFixtureUrl: true,
      },
    ],
    { requireAtLeastOne: true },
  );
  assert.equal(links.ok, true);
  assert.equal(links.normalized[0].countryCode, "KR");
  assert.equal(
    selectCountryPurchaseLink(links.normalized, "KR")?.purchaseUrl,
    "https://shop.example.kr/item",
  );

  const missingLinks = validateCountryPurchaseLinks([], {
    requireAtLeastOne: true,
  });
  assert.ok(missingLinks.reasons.includes("country_link_missing"));

  // Ingest affiliate / sponsored
  const affOk = ingestAffiliateOffer(offers[0]!, { mode: "fixture" });
  assert.equal(affOk.lane, "affiliate");
  assert.equal(affOk.commercialAgreementActivated, false);
  assert.equal(affOk.allowPublicPaidSurface, false);
  assert.ok(affOk.rejectionCodes.includes("commercial_agreement_not_activated"));
  assert.equal(affOk.commission.commissionRateKnown, false);

  const affInvented = ingestAffiliateOffer(offers[1]!, { mode: "fixture" });
  assert.equal(affInvented.adminStatus, "rejected");
  assert.ok(affInvented.rejectionCodes.includes("commission_rate_invented"));

  const affLookalike = ingestAffiliateOffer(offers[4]!, { mode: "fixture" });
  assert.ok(
    affLookalike.rejectionCodes.includes("disclosure_looks_like_organic_reason"),
  );

  const spOk = ingestSponsoredPlacement(placements[0]!, { mode: "fixture" });
  assert.equal(spOk.lane, "sponsored");
  assert.equal(spOk.zone, "sponsored_rail");

  const spOrganic = ingestSponsoredPlacement(placements[1]!, { mode: "fixture" });
  assert.ok(spOrganic.rejectionCodes.includes("organic_zone_forbidden"));

  // Expiry
  const now = new Date("2026-07-24T12:00:00.000Z");
  const expired = evaluateExpiry(
    {
      recordId: "aff-expired-003",
      startsAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:00:00.000Z",
    },
    now,
  );
  assert.equal(expired.expired, true);
  assert.equal(expired.activeWindow, false);

  const active = evaluateExpiry(
    {
      recordId: "aff-ok-kr-001",
      startsAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
    },
    now,
  );
  assert.equal(active.activeWindow, true);

  // Events + privacy
  const clickOk = validateClickConversionEvent(events[0]!);
  assert.equal(clickOk.ok, true);
  const healthBad = validateClickConversionEvent(events[2]!);
  assert.equal(healthBad.ok, false);
  assert.ok(healthBad.reasons.includes("health_targeting_forbidden"));

  // Organic / professional independence
  const independence = proveOrganicAndProfessionalIndependence({
    organicBase: [
      { id: "a", organicScore: 90 },
      { id: "b", organicScore: 70 },
    ],
    organicWithPaidNoise: [
      { id: "a", organicScore: 90 },
      { id: "b", organicScore: 70 },
    ],
    organicScorePayloadWithPaid: { organicScore: 90 },
    professionalBase: [
      { id: "u", routePriority: 100, expertFirst: true },
      { id: "n", routePriority: 10, expertFirst: false },
    ],
    professionalWithPaidNoise: [
      { id: "u", routePriority: 100, expertFirst: true },
      { id: "n", routePriority: 10, expertFirst: false },
    ],
    professionalRoutingPayloadWithPaid: {
      routePriority: 100,
      expertFirst: true,
    },
  });
  assert.equal(independence.ok, true);

  const independenceFail = proveOrganicAndProfessionalIndependence({
    organicBase: [
      { id: "a", organicScore: 90 },
      { id: "b", organicScore: 70 },
    ],
    organicWithPaidNoise: [
      { id: "a", organicScore: 90 },
      { id: "b", organicScore: 70 },
    ],
    organicScorePayloadWithPaid: {
      organicScore: 90,
      commissionRatePercent: 5,
    },
    professionalBase: [
      { id: "u", routePriority: 100, expertFirst: true },
    ],
    professionalWithPaidNoise: [
      { id: "u", routePriority: 100, expertFirst: true },
    ],
    professionalRoutingPayloadWithPaid: {
      routePriority: 100,
      isSponsored: true,
    },
  });
  assert.equal(independenceFail.ok, false);
  assert.ok(
    independenceFail.paidKeysInOrganicScore.includes("commissionRatePercent"),
  );
  assert.ok(
    independenceFail.paidKeysInProfessionalRouting.includes("isSponsored"),
  );

  // Full pipeline
  const result = runFixtureRevenueReadiness(now);
  assert.equal(result.taskId, "P3-T04");
  assert.equal(result.publishAllowed, false);
  assert.equal(result.publicVisible, false);
  assert.equal(result.commercialAgreementsActivated, false);
  assert.equal(result.databaseTouched, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.productionTouched, false);
  assert.equal(result.paidApiUsed, false);
  assert.equal(result.organicIndependence.ok, true);
  assert.equal(result.privacyBoundary.healthTargetingAllowed, false);
  assertNoCommercialActivation(result);

  const expiredCandidate = result.candidates.find(
    (c) => c.recordId === "aff-expired-003",
  );
  assert.ok(expiredCandidate);
  assert.equal(expiredCandidate!.adminStatus, "expired");

  const inventedCandidate = result.candidates.find(
    (c) => c.recordId === "aff-invented-rate-002",
  );
  assert.ok(inventedCandidate);
  assert.equal(inventedCandidate!.adminStatus, "rejected");

  const okCandidate = result.candidates.find(
    (c) => c.recordId === "aff-ok-kr-001",
  );
  assert.ok(okCandidate);
  assert.equal(okCandidate!.commercialAgreementActivated, false);
  assert.equal(okCandidate!.allowPublicPaidSurface, false);
  assert.equal(okCandidate!.adminStatus, "activation_blocked");
  assert.ok(
    okCandidate!.rejectionCodes.includes("commercial_agreement_not_activated"),
  );

  const healthEvent = result.eventValidations.find(
    (e) => e.eventId === "evt-health-forbidden-003",
  );
  assert.ok(healthEvent);
  assert.equal(healthEvent!.ok, false);

  assert.ok(result.audit.totals.offersSeen >= 5);
  assert.ok(result.audit.totals.placementsSeen >= 3);
  assert.ok(result.audit.totals.adminApprovedStructural >= 3);
  assert.ok(result.audit.totals.privacyViolations >= 1);
  assert.equal(result.audit.totals.agreementsActivated, 0);
  assert.equal(result.audit.commercialAgreementsActivated, false);
  assert.equal(result.audit.inventedCommissionRates, false);
  assert.equal(result.audit.inventedLiveUrls, false);

  // live_blocked must throw
  assert.throws(
    () => runRevenueReadiness({ mode: "live_blocked" }),
    /live_blocked/,
  );

  // dry_run mode also non-activating
  const dry = runRevenueReadiness({
    mode: "dry_run",
    now,
    humanApprovedIds: ["aff-ok-kr-001"],
  });
  assert.equal(dry.commercialAgreementsActivated, false);
  assert.ok(
    dry.candidates.every((c) => c.rejectionCodes.includes("dry_run_non_public")),
  );
  assertNoCommercialActivation(dry);

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "revenue-readiness",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "selftest-latest.json"),
    JSON.stringify(
      {
        taskId: result.taskId,
        runId: result.runId,
        audit: result.audit,
        commercialAgreementsActivated: false,
        publishAllowed: false,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("revenue-readiness selftest: OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

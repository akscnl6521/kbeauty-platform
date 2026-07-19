import assert from "node:assert/strict";
import { buildClinicRefreshPlanItem } from "../src/lib/clinic/clinicRefreshPolicy";
import type { ClinicCandidate } from "../src/lib/clinic/referralRankingPolicy";

const now = new Date("2026-07-19T00:00:00.000Z");

function clinic(overrides: Partial<ClinicCandidate> = {}): ClinicCandidate {
  return {
    id: "clinic-1",
    name: "테스트 피부과",
    specialties: ["피부과"],
    symptomTags: ["여드름"],
    treatmentInfoTags: [],
    distanceKm: 2,
    officialSiteUrl: "https://example.com",
    bookingUrl: null,
    evidence: [
      {
        sourceUrl: "https://example.com/acne",
        sourceType: "official_site",
        verifiedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    isPartner: false,
    partnershipType: "none",
    partnershipDisclosure: null,
    isActive: true,
    ...overrides,
  };
}

const routine = buildClinicRefreshPlanItem(clinic(), now);
assert.equal(routine.priority, "low");
assert.equal(routine.allowPublicRecommendation, true);
assert.deepEqual(routine.reasons, ["routine_reverification"]);

const missingEvidence = buildClinicRefreshPlanItem(clinic({ evidence: [] }), now);
assert.equal(missingEvidence.priority, "high");
assert.equal(missingEvidence.allowPublicRecommendation, false);
assert.ok(missingEvidence.reasons.includes("evidence_missing"));

const stale = buildClinicRefreshPlanItem(
  clinic({
    evidence: [
      {
        sourceUrl: "https://example.com",
        sourceType: "official_site",
        verifiedAt: "2025-01-01T00:00:00.000Z",
      },
    ],
  }),
  now
);
assert.equal(stale.priority, "high");
assert.ok(stale.reasons.includes("evidence_stale"));

const undisclosedPartner = buildClinicRefreshPlanItem(
  clinic({
    isPartner: true,
    partnershipType: "booking_fee",
    partnershipDisclosure: null,
  }),
  now
);
assert.equal(undisclosedPartner.allowPublicRecommendation, false);
assert.ok(undisclosedPartner.reasons.includes("partnership_disclosure_missing"));

const closed = buildClinicRefreshPlanItem(clinic({ isActive: false }), now);
assert.equal(closed.priority, "urgent");
assert.equal(closed.allowPublicRecommendation, false);
assert.ok(closed.checks.includes("operating_status"));

console.log("[clinic-refresh-policy-selftest] OK");

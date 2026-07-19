import assert from "node:assert/strict";
import { decideClinicSync, type ClinicSourceSnapshot } from "../src/lib/clinic/clinicSyncDecision";
import type { ClinicCandidate } from "../src/lib/clinic/referralRankingPolicy";

const existing: ClinicCandidate = {
  id: "clinic-1",
  name: "서울 피부과",
  specialties: ["dermatology", "acne"],
  symptomTags: ["acne", "redness"],
  treatmentInfoTags: [],
  distanceKm: 2,
  officialSiteUrl: "https://seoulskin.example.com",
  bookingUrl: "https://seoulskin.example.com/book",
  evidence: [
    {
      sourceUrl: "https://seoulskin.example.com",
      sourceType: "official_site",
      verifiedAt: "2026-07-19T00:00:00.000Z",
    },
  ],
  isPartner: false,
  partnershipType: "none",
  partnershipDisclosure: null,
  isActive: true,
};

const base: ClinicSourceSnapshot = {
  sourceUrl: "https://seoulskin.example.com",
  sourceType: "official_site",
  fetchedAt: "2026-07-19T00:00:00.000Z",
  sourceHash: "hash-1",
  name: "서울 피부과",
  officialSiteUrl: "https://seoulskin.example.com",
  bookingUrl: "https://seoulskin.example.com/book",
  specialties: ["acne", "dermatology"],
  symptomTags: ["redness", "acne"],
  isActive: true,
  partnershipType: "none",
  partnershipDisclosure: null,
};

assert.equal(decideClinicSync(base, [existing]).action, "no_change");
assert.equal(
  decideClinicSync({ ...base, bookingUrl: "https://seoulskin.example.com/reserve" }, [existing]).action,
  "update_candidate"
);
assert.equal(
  decideClinicSync({ ...base, name: "부산 피부과", officialSiteUrl: "https://busanskin.example.com", sourceUrl: "https://busanskin.example.com" }, [existing]).action,
  "insert_candidate"
);
assert.equal(
  decideClinicSync({ ...base, isActive: false }, [existing]).action,
  "block_listing"
);
assert.equal(
  decideClinicSync({ ...base, symptomTags: [] }, [existing]).action,
  "manual_review"
);
assert.equal(
  decideClinicSync({ ...base, partnershipType: "lead_fee", partnershipDisclosure: null }, [existing]).action,
  "manual_review"
);
for (const decision of [
  decideClinicSync(base, [existing]),
  decideClinicSync({ ...base, name: "부산 피부과", officialSiteUrl: "https://busanskin.example.com", sourceUrl: "https://busanskin.example.com" }, [existing]),
]) {
  assert.equal(decision.publishAllowed, false);
}

console.log("clinic sync decision selftest: ok");

import assert from "node:assert/strict";
import { buildClinicStagingSyncPlan } from "../src/lib/clinic/clinicStagingSyncPlan";
import type { ClinicCandidate } from "../src/lib/clinic/referralRankingPolicy";

const existing: ClinicCandidate[] = [{
  id: "clinic-1",
  name: "홍조 피부과",
  specialties: ["dermatology"],
  symptomTags: ["redness"],
  treatmentInfoTags: [],
  distanceKm: 2,
  officialSiteUrl: "https://clinic.example",
  bookingUrl: null,
  evidence: [{ sourceUrl: "https://clinic.example", sourceType: "official_site", verifiedAt: "2026-07-01" }],
  isPartner: false,
  partnershipType: "none",
  partnershipDisclosure: null,
  isActive: true,
}];

const plan = buildClinicStagingSyncPlan({
  existing,
  snapshots: [
    {
      sourceUrl: "https://clinic.example",
      sourceType: "official_site",
      fetchedAt: "2026-07-19T00:00:00Z",
      sourceHash: "hash-1",
      name: "홍조 피부과",
      officialSiteUrl: "https://clinic.example",
      bookingUrl: null,
      specialties: ["dermatology"],
      symptomTags: ["redness"],
      isActive: true,
      partnershipType: "none",
      partnershipDisclosure: null,
    },
    {
      sourceUrl: "https://new.example",
      sourceType: "official_site",
      fetchedAt: "2026-07-19T00:00:00Z",
      sourceHash: "hash-2",
      name: "여드름 피부과",
      officialSiteUrl: "https://new.example",
      bookingUrl: null,
      specialties: ["dermatology"],
      symptomTags: ["acne"],
      isActive: true,
      partnershipType: "none",
      partnershipDisclosure: null,
    },
  ],
});

assert.equal(plan.length, 2);
assert.equal(plan[0].action, "no_change");
assert.equal(plan[1].action, "insert_candidate");
assert.equal(plan.every((item) => item.publishAllowed === false), true);
console.log("clinic staging sync plan selftest passed");

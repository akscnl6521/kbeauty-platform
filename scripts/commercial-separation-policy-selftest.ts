import assert from "node:assert/strict";
import {
  assertOrganicOrderUnchanged,
  buildCommercialPresentation,
  type CommercialCandidate,
} from "../src/lib/commercial/commercialSeparationPolicy";

const candidates: CommercialCandidate[] = [
  {
    id: "organic-high",
    entityType: "product",
    organicScore: 92,
    relationship: "none",
    sponsorName: null,
    disclosureText: null,
    destinationUrl: null,
    organicRankEligible: true,
    evidenceVerified: true,
  },
  {
    id: "affiliate-mid",
    entityType: "product",
    organicScore: 80,
    relationship: "affiliate_link",
    sponsorName: null,
    disclosureText: null,
    destinationUrl: "https://shop.example/product",
    organicRankEligible: true,
    evidenceVerified: true,
  },
  {
    id: "sponsored-low",
    entityType: "product",
    organicScore: 10,
    relationship: "sponsored_product",
    sponsorName: "테스트 브랜드",
    disclosureText: null,
    destinationUrl: "https://brand.example/ad",
    organicRankEligible: false,
    evidenceVerified: true,
  },
  {
    id: "blocked",
    entityType: "clinic",
    organicScore: 99,
    relationship: "sponsored_clinic",
    sponsorName: null,
    disclosureText: null,
    destinationUrl: null,
    organicRankEligible: true,
    evidenceVerified: false,
  },
];

const presentation = buildCommercialPresentation(candidates);
assert.deepEqual(
  presentation.organic.map((candidate) => candidate.id),
  ["organic-high", "affiliate-mid"]
);
assert.equal(assertOrganicOrderUnchanged(candidates, presentation.organic), true);
assert.equal(presentation.affiliateEligible.length, 1);
assert.match(presentation.affiliateEligible[0]?.disclosureText ?? "", /수수료/);
assert.equal(presentation.sponsored.length, 1);
assert.match(presentation.sponsored[0]?.disclosureText ?? "", /유료 광고/);
assert.equal(presentation.blocked.length, 1);
assert.ok(presentation.blocked[0]?.reasonCodes.includes("evidence_unverified"));
assert.ok(presentation.blocked[0]?.reasonCodes.includes("commercial_destination_missing"));

console.log("commercial separation policy self-test: ok");

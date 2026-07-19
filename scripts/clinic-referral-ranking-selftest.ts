import assert from "node:assert/strict";
import {
  rankClinicCandidates,
  splitOrganicAndPartnered,
  validateClinicCandidate,
  type ClinicCandidate,
} from "../src/lib/clinic/referralRankingPolicy";

const clinics: ClinicCandidate[] = [
  {
    id: "clinic-a",
    name: "홍조 피부 진료센터",
    specialties: ["피부과"],
    symptomTags: ["홍조", "민감성"],
    treatmentInfoTags: ["혈관레이저", "장벽관리"],
    distanceKm: 3,
    officialSiteUrl: "https://clinic-a.example",
    bookingUrl: "https://clinic-a.example/book",
    evidence: [
      {
        sourceUrl: "https://clinic-a.example/redness",
        sourceType: "official_site",
        verifiedAt: "2026-07-01T00:00:00Z",
      },
    ],
    isPartner: false,
    partnershipType: "none",
    partnershipDisclosure: null,
    isActive: true,
  },
  {
    id: "clinic-b",
    name: "제휴 여드름 의원",
    specialties: ["피부과"],
    symptomTags: ["여드름"],
    treatmentInfoTags: ["여드름관리"],
    distanceKm: 1,
    officialSiteUrl: "https://clinic-b.example",
    bookingUrl: "https://clinic-b.example/book",
    evidence: [
      {
        sourceUrl: "https://clinic-b.example/acne",
        sourceType: "official_site",
        verifiedAt: "2026-07-10T00:00:00Z",
      },
    ],
    isPartner: true,
    partnershipType: "booking_fee",
    partnershipDisclosure: "예약이 완료되면 플랫폼이 수수료를 받을 수 있습니다.",
    isActive: true,
  },
  {
    id: "clinic-c",
    name: "근거 없는 피부관리소",
    specialties: ["피부관리"],
    symptomTags: ["홍조"],
    treatmentInfoTags: [],
    distanceKm: 0.5,
    officialSiteUrl: null,
    bookingUrl: null,
    evidence: [],
    isPartner: false,
    partnershipType: "none",
    partnershipDisclosure: null,
    isActive: true,
  },
];

const ranked = rankClinicCandidates(
  clinics,
  {
    symptomTags: ["홍조"],
    requestedSpecialty: "피부과",
    maxDistanceKm: 10,
    urgent: false,
  },
  new Date("2026-07-19T00:00:00Z")
);

assert.equal(ranked.length, 1);
assert.equal(ranked[0]?.id, "clinic-a");
assert.equal(ranked[0]?.displayDisclosure, null);

const acne = rankClinicCandidates(
  clinics,
  {
    symptomTags: ["여드름"],
    requestedSpecialty: "피부과",
    maxDistanceKm: 10,
    urgent: false,
  },
  new Date("2026-07-19T00:00:00Z")
);
assert.equal(acne[0]?.id, "clinic-b");
assert.match(acne[0]?.displayDisclosure ?? "", /수수료/);

const mixed = rankClinicCandidates(
  clinics,
  {
    symptomTags: ["홍조", "여드름"],
    requestedSpecialty: "피부과",
    maxDistanceKm: 10,
    urgent: false,
  },
  new Date("2026-07-19T00:00:00Z")
);
const split = splitOrganicAndPartnered(mixed);
assert.deepEqual(split.organic.map((clinic) => clinic.id), ["clinic-a"]);
assert.deepEqual(split.partnered.map((clinic) => clinic.id), ["clinic-b"]);
assert.equal(
  new Set([...split.organic, ...split.partnered].map((clinic) => clinic.id)).size,
  split.organic.length + split.partnered.length
);

const urgent = rankClinicCandidates(clinics, {
  symptomTags: ["홍조"],
  requestedSpecialty: "피부과",
  maxDistanceKm: null,
  urgent: true,
});
assert.deepEqual(urgent, []);

assert.ok(
  validateClinicCandidate({
    ...clinics[1]!,
    partnershipDisclosure: null,
  }).includes("partnership_disclosure_missing")
);

assert.ok(
  validateClinicCandidate({
    ...clinics[0]!,
    partnershipType: "lead_fee",
  }).includes("non_partner_partnership_type_mismatch")
);

console.log("clinic referral ranking self-test: ok");

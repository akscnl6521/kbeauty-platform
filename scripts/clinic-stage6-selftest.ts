import assert from "node:assert/strict";
import {
  buildFixtureClinicCandidates,
  runClinicCandidateCollection,
} from "../src/lib/clinic/clinicCollection";
import { buildClinicReferralPresentation } from "../src/lib/clinic/clinicReferralService";
import {
  advanceClinicReviewStatus,
  checkClinicFields,
  isClinicPublishable,
} from "../src/lib/clinic/clinicVerification";
import {
  maskLeadContact,
  resetConsultationLeadDryRunStore,
  submitConsultationLeadDryRun,
  validateConsultationLead,
} from "../src/lib/clinic/consultationLead";
import { rankClinicCandidates } from "../src/lib/clinic/referralRankingPolicy";

async function main() {
  const fixtures = buildFixtureClinicCandidates();
  assert.ok(fixtures.length >= 3, "fixture candidates required");
  assert.ok(fixtures.every((item) => item.fixtureOnly), "all seeds must be fixtureOnly");
  assert.equal(
    fixtures.filter(isClinicPublishable).length,
    0,
    "fixture clinics must never be user-publishable",
  );

  const complete = fixtures.find((item) => item.id === "fixture-organic-redness-seocho");
  assert.ok(complete);
  assert.equal(checkClinicFields(complete).ok, true);

  const incomplete = fixtures.find((item) => item.id === "fixture-incomplete-directory");
  assert.ok(incomplete);
  assert.equal(checkClinicFields(incomplete).ok, false);

  const reviewBlocked = advanceClinicReviewStatus(complete, "mark_admin_reviewed");
  assert.equal(reviewBlocked.ok, false);
  assert.ok(reviewBlocked.reasons.includes("fixture_review_only_dry_run"));

  const collection = await runClinicCandidateCollection();
  assert.equal(collection.publishAllowed, false);
  assert.equal(collection.databaseTouched, false);
  assert.ok(collection.failures.some((item) => item.failure === "dry_run_only"));
  assert.ok(collection.failures.some((item) => item.failure === "authentication_required"));

  const presentation = buildClinicReferralPresentation({
    routes: [
      {
        professionalType: "dermatology",
        urgency: "soon",
        reason: "redness_vascular",
        productRecommendationAllowed: true,
      },
    ],
    now: new Date("2026-07-23T00:00:00Z"),
  });
  assert.equal(presentation.publishableCount, 0);
  assert.equal(presentation.emptyReason, "no_publishable_clinics");
  assert.ok(presentation.demoPreview.length > 0, "demo preview should show labeled fixtures");
  assert.ok(presentation.demoPreview.every((item) => item.isDemo));
  assert.ok(presentation.organic.every((item) => !item.isPartner));
  assert.ok(
    presentation.demoPreview.some((item) => item.isPartner) ||
      presentation.demoPreview.some((item) => !item.isPartner),
  );

  const languageFiltered = rankClinicCandidates(
    fixtures.map((item) => ({
      id: item.id,
      name: item.name,
      specialties: item.specialties,
      symptomTags: item.symptomTags,
      treatmentInfoTags: item.treatmentInfoTags,
      distanceKm: item.distanceKm,
      officialSiteUrl: item.officialSiteUrl,
      bookingUrl: item.bookingUrl,
      evidence: item.evidence,
      isPartner: item.isPartner,
      partnershipType: item.partnershipType,
      partnershipDisclosure: item.partnershipDisclosure,
      isActive: item.isActive,
      languages: item.languages,
      consultationBudgetBand: item.consultationBudgetBand,
    })),
    {
      symptomTags: ["홍조"],
      requestedSpecialty: "피부과",
      maxDistanceKm: 30,
      urgent: false,
      languages: ["en"],
    },
    new Date("2026-07-23T00:00:00Z"),
  );
  assert.ok(languageFiltered.every((item) => (item.languages ?? []).includes("en")));

  resetConsultationLeadDryRunStore();
  assert.equal(
    validateConsultationLead({
      clinicId: null,
      professionalType: "dermatology",
      contactMethod: "email",
      contactValue: "bad",
      preferredLanguage: "ko",
      consentPersonalInfo: true,
      consentShareWithClinic: true,
      consentNotDiagnosis: true,
      notes: null,
    }).ok,
    false,
  );

  const accepted = submitConsultationLeadDryRun({
    clinicId: "fixture-organic-redness-seocho",
    professionalType: "dermatology",
    contactMethod: "email",
    contactValue: "user@example.com",
    preferredLanguage: "ko",
    consentPersonalInfo: true,
    consentShareWithClinic: true,
    consentNotDiagnosis: true,
    notes: null,
  });
  assert.equal(accepted.status, "dry_run_accepted");
  assert.equal(accepted.databaseTouched, false);
  assert.equal(maskLeadContact("user@example.com", "email"), "u***@example.com");

  const urgent = buildClinicReferralPresentation({
    routes: [
      {
        professionalType: "urgent_care",
        urgency: "emergency",
        reason: "breathing_difficulty",
        productRecommendationAllowed: false,
      },
    ],
  });
  assert.equal(urgent.emptyReason, "urgent_no_listing");
  assert.equal(urgent.demoPreview.length, 0);

  console.log("clinic stage6 selftest: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

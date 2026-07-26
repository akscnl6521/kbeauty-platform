import assert from "node:assert/strict";
import {
  applyConfirmedProfilePatch,
  applyProfileObservation,
  createEmptyBeautyProfile,
  observationFromDomainQuiz,
} from "../src/lib/profile";
import { applySymptomSafetyToRecommendation } from "../src/lib/ai/symptomSafety";
import type { AnalyzeSkinRequest } from "../src/lib/ai/types";
import type { Recommendation } from "../src/lib/recommend";
import { buildCareGuidanceViewModel } from "../src/lib/care/guidanceViewModel";
import {
  beautyDomainForCategory,
  BEAUTY_DOMAINS,
} from "../src/lib/catalog/taxonomy/domains";
import {
  isOrdinaryCosmeticRecommendationAllowed,
  type CommonProduct,
} from "../src/lib/catalog/commonProduct";
import { createCheckInSchedule } from "../src/lib/care/schedule";
import { rankMascaraProducts, rankLipProducts } from "../src/lib/catalog/makeup";
import { rankScalpProducts } from "../src/lib/catalog/scalpHair/rankScalpHair";

const t0 = "2026-07-20T00:00:00.000Z";
const t1 = "2026-07-23T00:00:00.000Z";

let profile = applyProfileObservation(createEmptyBeautyProfile(t0), {
  source: "user_confirmed",
  recordedAt: t0,
  skinType: "dry",
  concerns: ["dryness"],
  allergies: ["fragrance"],
});
profile = applyProfileObservation(profile, {
  source: "inferred",
  recordedAt: t1,
  skinType: "oily",
  concerns: ["redness"],
});
assert.equal(profile.skin.type?.value, "dry");
assert.deepEqual(profile.skin.concerns.value, ["dryness"]);

profile = applyConfirmedProfilePatch(profile, {
  skinType: "combination",
  preferredBrands: ["BrandA"],
  excludedBrands: ["BrandB"],
});
assert.equal(profile.skin.type?.value, "combination");
assert.equal(profile.skin.type?.source, "user_confirmed");
assert.deepEqual(profile.general.preferredBrands.value, ["BrandA"]);

const mascaraObs = observationFromDomainQuiz({
  domain: "mascara",
  answers: { sensitiveEyes: "yes", effect: "curl" },
  recordedAt: t1,
});
profile = applyProfileObservation(profile, mascaraObs);
assert.equal(profile.makeup.eyeSensitivity?.value, true);

assert.ok(BEAUTY_DOMAINS.includes("beauty_devices"));
assert.equal(beautyDomainForCategory("mascara"), "eye_makeup");
assert.equal(beautyDomainForCategory("lipstick"), "lip_color");
assert.equal(beautyDomainForCategory("sensitive_scalp_shampoo"), "scalp_care");

const mascara = rankMascaraProducts(
  { wantCurl: true, waterproof: true },
  [
    {
      id: "m1",
      category: "mascara",
      waterproof: true,
      mascaraEffects: ["curl"],
    },
    { id: "m2", category: "serum" },
  ]
);
assert.equal(mascara[0]?.product.id, "m1");
assert.ok(!mascara.some((r) => r.product.id === "m2"));

const lip = rankLipProducts(
  { undertone: "cool", finish: "matte" },
  [
    {
      id: "l1",
      category: "lip_tint",
      undertoneFit: ["cool"],
      finish: "matte",
      lipEffects: ["matte"],
    },
  ]
);
assert.ok(lip[0] && lip[0].score > 0);

const scalp = rankScalpProducts(
  { scalpType: "oily" },
  [{ id: "s1", category: "oily_scalp_shampoo", scalpTypes: ["oily"] }]
);
assert.equal(scalp[0]?.product.id, "s1");

const base: CommonProduct = {
  id: "p1",
  brandId: "b1",
  canonicalName: "Product",
  displayName: "Product",
  domain: "face_skincare",
  category: "serum",
  regulatoryClass: "general_cosmetic",
  eligibility: "recommendation_ready",
  categoryAttributes: {},
  variantIds: [],
  sourceIds: [],
  duplicateGroupId: null,
  reformulationOfId: null,
  collectedAt: null,
  verifiedAt: null,
  refreshDueAt: null,
  dataCompleteness: 1,
  sourceConfidence: 1,
  commercial: {
    organicRank: 1,
    isAffiliate: true,
    isSponsored: false,
    disclosureLabel: "affiliate",
    partner: null,
    commissionType: null,
    campaignId: null,
    sponsoredPlacement: null,
    affiliateUrl: null,
    affiliateVerifiedAt: null,
  },
};
assert.equal(isOrdinaryCosmeticRecommendationAllowed(base), true);
assert.equal(
  isOrdinaryCosmeticRecommendationAllowed({
    ...base,
    regulatoryClass: "medical_device",
  }),
  false
);

function baseRecommendation(): Recommendation {
  return {
    skinConcerns: ["여드름"],
    recommendedIngredients: ["Niacinamide"],
    ingredientsToAvoid: [],
    confidenceScore: 0.7,
    managementLevel: "cosmetic_care",
    manageableWithCosmetics: ["가벼운 관리"],
    precautions: [],
    notRecommendedReasons: [],
    expertReferralReasons: [],
  };
}

const urgentInput: AnalyzeSkinRequest = {
  mode: "manual",
  skinTone: "중간",
  undertone: "중립",
  concerns: ["알레르기"],
  sensitivity: "높음",
  concernObservations: [
    {
      concern: "알레르기",
      areas: ["cheek"],
      severity: "severe",
      duration: "under_3_days",
      worsening: true,
      redFlags: ["breathing_difficulty"],
    },
  ],
};
const urgent = applySymptomSafetyToRecommendation(baseRecommendation(), urgentInput);
assert.equal(urgent.managementLevel, "urgent_check");
assert.equal(urgent.professionalRoutes?.[0]?.professionalType, "urgent_care");
assert.equal(urgent.professionalRoutes?.[0]?.productRecommendationAllowed, false);

const acneInput: AnalyzeSkinRequest = {
  mode: "manual",
  skinTone: "중간",
  undertone: "중립",
  concerns: ["여드름"],
  sensitivity: "보통",
  concernObservations: [
    {
      concern: "여드름",
      areas: ["chin"],
      severity: "severe",
      duration: "over_3_months",
      worsening: true,
      redFlags: ["pain"],
    },
  ],
};
const acne = applySymptomSafetyToRecommendation(baseRecommendation(), acneInput);
assert.equal(acne.managementLevel, "expert_first");
assert.equal(acne.professionalRoutes?.[0]?.professionalType, "dermatology");
assert.equal(acne.professionalRoutes?.[0]?.productRecommendationAllowed, false);

const guidance = buildCareGuidanceViewModel(acne as unknown as Record<string, unknown>);
assert.equal(guidance.clinicMode, "priority");
assert.ok(guidance.professionalRoutes.length > 0);

let id = 0;
const schedule = createCheckInSchedule({
  analysisSessionId: "a1",
  routineId: "r1",
  startAt: t1,
  timezone: "Asia/Seoul",
  idFactory: () => `c${++id}`,
});
assert.deepEqual(
  schedule.map((item) => item.day),
  [3, 7, 15, 30]
);

console.log(
  JSON.stringify({
    ok: true,
    profileVersion: profile.version,
    professionalRoutes: acne.professionalRoutes?.length ?? 0,
  })
);

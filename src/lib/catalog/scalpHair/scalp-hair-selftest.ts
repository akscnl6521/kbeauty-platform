/**
 * Staging env gate + scalp/hair domain selftests.
 */
import {
  assertCatalogIngestionAllowed,
  assertCatalogMigrationAllowed,
  assessCatalogEnvironment,
  KNOWN_PRODUCTION_SUPABASE_REF,
  readCatalogEnvSnapshot,
} from "@/lib/catalog/automation/ingestionGate";
import {
  catalogDomainForCategory,
  isHairLossTreatmentMisclassification,
  normalizeScalpHairCategoryAlias,
} from "@/lib/catalog/scalpHair/categories";
import {
  isLikelyMedicinalHairActive,
  validateHairLossFunctionalClaim,
} from "@/lib/catalog/scalpHair/functionalClaims";
import { classifyScalpHairIngredientTokens } from "@/lib/catalog/scalpHair/ingredientHints";
import {
  rankHairProducts,
  rankScalpProducts,
} from "@/lib/catalog/scalpHair/rankScalpHair";
import {
  assessHairLossObservationSafety,
  forbidsHairLossTreatmentLanguage,
} from "@/lib/catalog/scalpHair/types";
import { rankProducts } from "@/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "@/lib/recommend/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[scalp-hair-selftest] ${msg}`);
}

export function runScalpHairFoundationSelftests(): {
  ok: true;
  checks: number;
} {
  let checks = 0;

  // --- Environment gates ---
  const shared = assertCatalogIngestionAllowed({
    APP_ENV: "preview",
    CATALOG_DATABASE_ENV: "staging",
    CATALOG_INGESTION_ENABLED: "true",
    CATALOG_DRY_RUN: "true",
    CATALOG_AUTO_PROMOTE: "false",
    SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_SUPABASE_REF,
    PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_SUPABASE_REF,
  });
  assert(shared.status === "blocked", "same ref blocked");
  assert(
    shared.status === "blocked" && shared.code === "STAGING_DATABASE_REQUIRED",
    "STAGING_DATABASE_REQUIRED"
  );

  const prodEnv = assertCatalogIngestionAllowed({
    APP_ENV: "production",
    CATALOG_DATABASE_ENV: "staging",
    CATALOG_INGESTION_ENABLED: "true",
    CATALOG_DRY_RUN: "true",
    SUPABASE_PROJECT_REF: "stagingprojectref01",
    PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_SUPABASE_REF,
  });
  assert(prodEnv.status === "blocked", "production app blocked");

  const stagingOk = assertCatalogIngestionAllowed({
    APP_ENV: "preview",
    CATALOG_DATABASE_ENV: "staging",
    CATALOG_INGESTION_ENABLED: "true",
    CATALOG_DRY_RUN: "true",
    CATALOG_AUTO_PROMOTE: "false",
    SUPABASE_PROJECT_REF: "stagingprojectref01",
    PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_SUPABASE_REF,
  });
  assert(stagingOk.status === "allowed", "staging dry-run allowed");

  const migBlocked = assertCatalogMigrationAllowed({
    APP_ENV: "preview",
    CATALOG_DATABASE_ENV: "staging",
    SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_SUPABASE_REF,
  });
  assert(migBlocked.status === "blocked", "migration blocked on shared ref");

  const snap = readCatalogEnvSnapshot({
    APP_ENV: "preview",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingprojectref01.supabase.co",
  });
  assert(snap.projectRef === "stagingprojectref01", "ref from url");
  assert(
    !JSON.stringify(assessCatalogEnvironment({ projectRef: "abc" })).includes(
      "eyJ"
    ),
    "no jwt-like secrets in assessment"
  );
  checks += 1;

  // --- Categories ---
  assert(
    normalizeScalpHairCategoryAlias("dry scalp shampoo").category ===
      "dry_scalp_shampoo",
    "dry scalp"
  );
  assert(
    normalizeScalpHairCategoryAlias("oily_scalp_shampoo").category ===
      "oily_scalp_shampoo",
    "oily scalp"
  );
  assert(
    normalizeScalpHairCategoryAlias("anti dandruff").category ===
      "anti_dandruff_shampoo",
    "anti dandruff"
  );
  assert(
    normalizeScalpHairCategoryAlias("conditioner").category === "conditioner",
    "conditioner"
  );
  assert(
    normalizeScalpHairCategoryAlias("volume shampoo").category ===
      "volume_shampoo",
    "volume shampoo"
  );
  assert(
    normalizeScalpHairCategoryAlias("hair loss shampoo").needsReview === true,
    "hair loss needs review"
  );
  assert(
    catalogDomainForCategory("scalp_shampoo") === "scalp",
    "scalp domain"
  );
  assert(catalogDomainForCategory("conditioner") === "hair", "hair domain");
  assert(
    catalogDomainForCategory("serum") === "face",
    "face serum not scalp"
  );
  assert(
    isHairLossTreatmentMisclassification("volume_shampoo", "탈모 치료 샴푸"),
    "volume not treatment"
  );
  checks += 1;

  // --- Ingredients ---
  const classified = classifyScalpHairIngredientTokens([
    { canonicalKey: "sodium_laureth_sulfate", ingredientRaw: "Sodium Laureth Sulfate" },
    { canonicalKey: "parfum", ingredientRaw: "Fragrance" },
    { canonicalKey: "menthol", ingredientRaw: "Menthol" },
    { canonicalKey: "piroctone_olamine", ingredientRaw: "Piroctone Olamine" },
    { canonicalKey: "salicylic_acid", ingredientRaw: "Salicylic Acid" },
    { canonicalKey: "ketoconazole", ingredientRaw: "Ketoconazole" },
    { canonicalKey: "unknown_xyz", ingredientRaw: "Unknown Exotic XYZ" },
  ]);
  assert(classified.surfactants.length >= 1, "surfactant");
  assert(classified.fragranceOrMenthol.length >= 2, "fragrance menthol");
  assert(classified.antiDandruff.length >= 1, "anti dandruff");
  assert(classified.medicinalExclude.length >= 1, "medicinal");
  assert(classified.unknownPreserved.includes("Unknown Exotic XYZ"), "unknown kept");
  assert(isLikelyMedicinalHairActive("Ketoconazole"), "keto medicinal");
  checks += 1;

  // --- Functional claims ---
  const verified = validateHairLossFunctionalClaim({
    claimTextOriginal: "탈모 증상 완화 기능성 화장품",
    country: "KR",
    sourceUrl: "https://www.example-official.test/product/1",
    sourceType: "official_brand",
  });
  assert(verified.verified === true, "official claim verified");
  assert(verified.allowUserBadge === true, "badge allowed");

  const sellerOnly = validateHairLossFunctionalClaim({
    claimTextOriginal: "탈모 증상 완화 기능성 화장품",
    sourceUrl: "https://www.coupang.com/vp/products/1",
    sourceType: "seller_copy",
  });
  assert(sellerOnly.needsReview === true, "seller needs review");
  assert(sellerOnly.allowUserBadge === false, "no badge");

  const noSource = validateHairLossFunctionalClaim({
    claimTextOriginal: "탈모 증상 완화 기능성 화장품",
    sourceType: "unknown",
  });
  assert(noSource.allowUserBadge === false, "no source no badge");

  const volume = validateHairLossFunctionalClaim({
    claimTextOriginal: "볼륨 샴푸",
    sourceType: "official_brand",
    sourceUrl: "https://www.example-official.test/x",
  });
  assert(volume.verified === false, "volume not functional");
  assert(
    volume.reasons.includes("volume_is_not_hair_loss_functional"),
    "volume reason"
  );
  checks += 1;

  // --- Hair loss safety ---
  const cosmetic = assessHairLossObservationSafety({
    patterns: ["diffuse_shedding"],
    onset: "gradual",
    scalpSymptoms: ["none"],
    recentTriggers: [],
  });
  assert(cosmetic.level === "cosmetic_support", "gradual diffuse ok");

  const patchy = assessHairLossObservationSafety({
    patterns: ["patchy_loss"],
    onset: "gradual",
    scalpSymptoms: ["none"],
    recentTriggers: [],
  });
  assert(patchy.level === "professional_consultation", "patchy consult");

  const suddenPain = assessHairLossObservationSafety({
    patterns: ["hair_thinning"],
    onset: "sudden",
    scalpSymptoms: ["pain"],
    recentTriggers: [],
  });
  assert(
    suddenPain.level === "professional_consultation" ||
      suddenPain.level === "urgent_check",
    "sudden pain priority"
  );

  const urgent = assessHairLossObservationSafety({
    patterns: ["diffuse_shedding"],
    onset: "sudden",
    scalpSymptoms: ["oozing", "bleeding"],
    recentTriggers: [],
  });
  assert(urgent.level === "urgent_check", "oozing urgent");
  assert(!/원형탈모|지루성/.test(urgent.userMessageKo), "no disease name");
  assert(!forbidsHairLossTreatmentLanguage(urgent.userMessageKo), "safe copy");
  assert(forbidsHairLossTreatmentLanguage("탈모 치료 보장"), "forbid treatment");
  checks += 1;

  // --- Ranking separation ---
  const scalpRanked = rankScalpProducts(
    { scalpType: "oily", scalpConcerns: ["excess_oil"] },
    [
      {
        id: "s1",
        category: "oily_scalp_shampoo",
        scalpTypes: ["oily"],
        scalpConcerns: ["excess_oil"],
      },
      { id: "face1", category: "serum", scalpTypes: ["oily"] },
      {
        id: "hls1",
        category: "functional_hair_loss_shampoo",
        functionalClaimVerified: false,
      },
    ]
  );
  assert(
    scalpRanked.every((r) => r.product.id !== "face1"),
    "face excluded from scalp rank"
  );
  assert(
    !scalpRanked.some((r) => r.product.id === "hls1"),
    "unverified functional excluded"
  );

  const consultSuppress = rankScalpProducts(
    {
      scalpType: "normal",
      hairLossObservation: {
        patterns: ["patchy_loss"],
        scalpSymptoms: ["none"],
        recentTriggers: [],
      },
    },
    [
      {
        id: "s2",
        category: "scalp_shampoo",
        scalpTypes: ["normal"],
        scalpConcerns: [],
      },
    ]
  );
  assert(
    consultSuppress.every((r) => r.excluded || r.score === 0),
    "consult suppresses ranking"
  );

  const hairRanked = rankHairProducts(
    { hairType: "fine", hairConcerns: ["dryness"] },
    [
      {
        id: "h1",
        category: "moisturizing_shampoo",
        hairTypes: ["fine"],
        hairConcerns: ["dryness"],
      },
      { id: "lip", category: "lipstick" },
    ]
  );
  assert(hairRanked.every((r) => r.product.id !== "lip"), "lipstick excluded");
  checks += 1;

  // Face rankProducts unchanged smoke
  const rec: Recommendation = {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Glycerin"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const products: RankableProduct[] = [
    { id: "f1", key_ingredients: ["Glycerin"], skin_concern: ["Dryness"] },
  ];
  assert(rankProducts(rec, products)[0]!.score > 0, "face rank intact");
  checks += 1;

  return { ok: true, checks };
}

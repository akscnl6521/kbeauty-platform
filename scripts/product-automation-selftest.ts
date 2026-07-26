/**
 * T03 product automation + category expansion self-test.
 * Fixtures/dry-run only — no live scrape, no Staging/Production writes.
 */
import assert from "node:assert/strict";
import {
  PRODUCT_INGESTION_STAGES,
  PRODUCT_AUTOMATION_FIXTURES,
  runProductAutomationDryRun,
  resumeProductAutomationRun,
  createEmptyCheckpoint,
  safeRecommendMascara,
  safeRecommendLip,
  safeRecommendShampooScalp,
  toAdminCatalogReviewLinks,
  toCommonProductDraft,
  extractCategoryAttributes,
  resolveCategoryExtractor,
  candidatesEligibleForAdminReview,
} from "../src/lib/catalog/productAutomation";
import { isOrdinaryCosmeticRecommendationAllowed } from "../src/lib/catalog/commonProduct";

function main() {
  assert.equal(PRODUCT_INGESTION_STAGES.length, 18, "18 ingestion stages");
  assert.ok(PRODUCT_AUTOMATION_FIXTURES.length >= 3, "fixtures for mascara/lip/shampoo");

  assert.equal(resolveCategoryExtractor("mascara"), "mascara");
  assert.equal(resolveCategoryExtractor("lip_tint"), "lip");
  assert.equal(resolveCategoryExtractor("sensitive_scalp_shampoo"), "hair_scalp");

  const mascaraAttrs = extractCategoryAttributes(
    PRODUCT_AUTOMATION_FIXTURES[0]!.product
  );
  assert.equal(mascaraAttrs.extractorId, "mascara");
  assert.ok(mascaraAttrs.mascaraEffects?.includes("curl"), "mascara curl attr");
  assert.equal(mascaraAttrs.waterproof, true);

  const lipAttrs = extractCategoryAttributes(PRODUCT_AUTOMATION_FIXTURES[1]!.product);
  assert.equal(lipAttrs.extractorId, "lip");
  assert.ok(lipAttrs.undertoneFit?.includes("cool"), "lip cool undertone");

  const shampooAttrs = extractCategoryAttributes(
    PRODUCT_AUTOMATION_FIXTURES[2]!.product
  );
  assert.equal(shampooAttrs.extractorId, "hair_scalp");
  assert.ok(shampooAttrs.scalpTypes?.includes("sensitive"), "sensitive scalp");

  const summary = runProductAutomationDryRun();
  assert.equal(summary.mode, "fixture");
  assert.equal(summary.stages.length, 18);
  assert.ok(summary.candidates.length >= 3, "candidates produced");
  assert.equal(summary.checkpoint.status, "completed");
  assert.equal(summary.checkpoint.lastCompletedStageIndex, 17);
  assert.equal(summary.totals.recommendationReady, 0, "fixtures never recommendation_ready");
  assert.ok(summary.totals.withIngredients >= 3, "inci parsed");
  assert.ok(summary.totals.withOffers >= 3, "offers present");
  assert.ok(summary.totals.withImages >= 3, "images present");
  assert.ok(summary.totals.duplicates >= 1, "size variant / dedupe detected");
  assert.ok(summary.totals.needsReview >= 1, "review queue populated");

  for (const c of summary.candidates) {
    assert.equal(c.autoPromote, false, "never auto-promote");
    assert.equal(c.isFixture, true);
    assert.ok(c.evidence.every((e) => e.liveVerified === false), "no fake live verify");
    assert.ok(
      c.eligibility === "verification_required" ||
        c.eligibility === "insufficient_data",
      `fixture eligibility gated: ${c.candidateId}`
    );
    assert.ok(c.refreshPlan, "refresh plan attached");
    assert.ok(c.ingredients && c.ingredients.tokens.length > 0, "INCI tokens");
    assert.ok(c.stageReached === "refresh_scheduling");
  }

  const sizeVariant = summary.candidates.find(
    (c) => c.candidateId === "fx-mascara-dup-size"
  );
  assert.ok(sizeVariant?.dedupe?.kind === "same_product_different_size", "size dedupe");
  assert.ok(sizeVariant?.duplicateGroupId, "duplicate group id");

  // Resume: process first fixture, then resume remainder
  const firstOnly = runProductAutomationDryRun({
    fixtures: [PRODUCT_AUTOMATION_FIXTURES[0]!],
    runId: "pa-resume-test",
    allFixturesForDedupe: PRODUCT_AUTOMATION_FIXTURES,
  });
  assert.equal(firstOnly.checkpoint.status, "paused");
  assert.ok(firstOnly.checkpoint.pendingCandidateIds.length >= 2);

  const resumed = resumeProductAutomationRun({
    checkpoint: firstOnly.checkpoint,
    fixtures: PRODUCT_AUTOMATION_FIXTURES,
  });
  assert.equal(resumed.checkpoint.status, "completed");
  assert.equal(resumed.checkpoint.pendingCandidateIds.length, 0);
  assert.ok(
    resumed.checkpoint.processedCandidateIds.length >=
      PRODUCT_AUTOMATION_FIXTURES.length
  );

  const empty = createEmptyCheckpoint("pa-empty");
  assert.equal(empty.status, "running");
  assert.equal(empty.lastCompletedStageIndex, -1);

  const mascaraRec = safeRecommendMascara({
    quiz: { wantCurl: true, waterproof: true },
    candidates: summary.candidates,
  });
  assert.equal(mascaraRec.domain, "mascara");
  assert.equal(mascaraRec.productRecommendationAllowed, true);
  assert.ok(mascaraRec.items.length >= 1, "mascara ranked");
  assert.ok(
    mascaraRec.items.every((i) => i.purchaseClaimAllowed === false),
    "no purchase claim"
  );

  const mascaraBlocked = safeRecommendMascara({
    quiz: { wantCurl: true },
    candidates: summary.candidates,
    acuteEyeSignal: true,
  });
  assert.equal(mascaraBlocked.productRecommendationAllowed, false);
  assert.equal(mascaraBlocked.items.length, 0);

  const lipRec = safeRecommendLip({
    quiz: { undertone: "cool", finish: "matte", wantStain: true },
    candidates: summary.candidates,
  });
  assert.ok(lipRec.items.some((i) => i.id === "fx-lip-cool-matte"), "lip cool matte");

  const shampooRec = safeRecommendShampooScalp({
    quiz: { scalpType: "sensitive" },
    candidates: summary.candidates,
  });
  assert.ok(
    shampooRec.items.some((i) => i.id === "fx-shampoo-sensitive-scalp"),
    "sensitive shampoo"
  );

  const shampooBlocked = safeRecommendShampooScalp({
    quiz: { scalpType: "sensitive" },
    candidates: summary.candidates,
    hairLossObservation: {
      patterns: ["patchy_loss"],
      onset: "sudden",
      scalpSymptoms: ["oozing", "bleeding"],
      recentTriggers: [],
    },
  });
  assert.equal(shampooBlocked.productRecommendationAllowed, false);
  assert.ok(String(shampooBlocked.blockReason).includes("safety_"));

  const links = toAdminCatalogReviewLinks(summary);
  assert.equal(links.length, summary.candidates.length);
  assert.ok(links.every((l) => l.adminPath.startsWith("/admin/catalog/review")));
  assert.ok(links.every((l) => l.stagingWriteAllowed === false));
  assert.ok(links.every((l) => l.autoPromote === false));

  const reviewable = candidatesEligibleForAdminReview(summary.candidates);
  assert.ok(reviewable.length === summary.candidates.length);

  const common = toCommonProductDraft(summary.candidates[0]!);
  assert.equal(common.id, summary.candidates[0]!.candidateId);
  assert.equal(common.commercial.isAffiliate, false);
  assert.equal(
    isOrdinaryCosmeticRecommendationAllowed(common),
    false,
    "fixtures not ordinary-ready"
  );

  console.log(
    JSON.stringify({
      ok: true,
      candidates: summary.totals.discovered,
      duplicates: summary.totals.duplicates,
      needsReview: summary.totals.needsReview,
      recommendationReady: summary.totals.recommendationReady,
      mascaraTop: mascaraRec.items[0]?.id ?? null,
      lipTop: lipRec.items[0]?.id ?? null,
      shampooTop: shampooRec.items[0]?.id ?? null,
    })
  );
}

main();

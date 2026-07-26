/**
 * Product automation dry-run pipeline.
 * Connects discovery → normalize → verify → eligibility → staging/admin hints.
 * Fixtures only unless a future Staging path is explicitly gated.
 */

import { createHash } from "node:crypto";
import {
  buildProductIdentity,
  compareProductIdentity,
} from "@/lib/catalog/automation/productIdentity";
import {
  validateStagingOffer,
  validateStagingProduct,
} from "@/lib/catalog/automation/validators";
import type { RecommendationEligibility } from "@/lib/catalog/commonProduct";
import {
  classifyCatalogQualityStatus,
  type CatalogQualityStatus,
} from "@/lib/catalog/qualityStatus";
import { getCatalogRefreshPlan } from "@/lib/catalog/refreshPolicy";
import {
  validateProductMediaUrl,
  resolveUsageRights,
  type CatalogProductMediaDraft,
} from "@/lib/catalog/media/validateMedia";
import {
  validateShadeVariant,
  validateSizeVariant,
} from "@/lib/catalog/variants/variantModel";
import {
  extractCategoryAttributes,
  resolveDomainForExtractor,
} from "./categoryExtractors";
import {
  PRODUCT_AUTOMATION_FIXTURES,
  parseFixtureIngredients,
  type ProductAutomationFixture,
} from "./fixtures";
import {
  PRODUCT_INGESTION_STAGES,
  type FieldVerificationMap,
  type ProductAutomationCandidate,
  type ProductAutomationReviewStatus,
  type ProductAutomationRunCheckpoint,
  type ProductAutomationRunSummary,
  type UsageMediaMetadataDraft,
} from "./types";

function hashId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function completenessScore(input: {
  hasBrand: boolean;
  hasName: boolean;
  hasCategory: boolean;
  hasIngredients: boolean;
  hasImage: boolean;
  hasOffer: boolean;
  hasEvidence: boolean;
  hasSize: boolean;
}): number {
  const checks = [
    input.hasBrand,
    input.hasName,
    input.hasCategory,
    input.hasIngredients,
    input.hasImage,
    input.hasOffer,
    input.hasEvidence,
    input.hasSize,
  ];
  const ok = checks.filter(Boolean).length;
  return Number((ok / checks.length).toFixed(2));
}

function mapEligibility(input: {
  quality: CatalogQualityStatus;
  completeness: number;
  liveOfficial: boolean;
  hasIngredients: boolean;
  hasOffer: boolean;
}): RecommendationEligibility {
  if (input.quality === "blocked_by_policy") return "safety_hold";
  if (input.quality === "discontinued" || input.quality === "unavailable") {
    return "unavailable_in_country";
  }
  if (input.quality === "duplicate") return "verification_required";
  if (!input.hasIngredients || !input.hasOffer || input.completeness < 0.75) {
    return "insufficient_data";
  }
  if (!input.liveOfficial) {
    // Fixtures / unverified official pages never become recommendation_ready.
    return "verification_required";
  }
  if (
    input.quality === "staging_ready" &&
    input.completeness >= 0.9 &&
    input.liveOfficial
  ) {
    return "recommendation_ready";
  }
  return "verification_required";
}

function mapReviewStatus(
  quality: CatalogQualityStatus,
  eligibility: RecommendationEligibility
): ProductAutomationReviewStatus {
  if (quality === "blocked_by_policy") return "blocked";
  if (quality === "duplicate") return "duplicate_watch";
  if (quality === "staging_ready" && eligibility === "recommendation_ready") {
    return "ready_for_admin";
  }
  if (
    quality === "review_required" ||
    quality === "source_unverified" ||
    eligibility === "verification_required" ||
    eligibility === "insufficient_data"
  ) {
    return "needs_review";
  }
  return "staging_candidate";
}

function buildImages(
  fixture: ProductAutomationFixture
): CatalogProductMediaDraft[] {
  const url = fixture.product.primaryImageUrl || fixture.product.imageUrls[0];
  if (!url) return [];
  const page = fixture.product.officialProductUrl ?? fixture.evidence[0]?.sourceUrl ?? "";
  const validation = validateProductMediaUrl(url, {
    sourcePageUrl: page,
    sourceType: "official_brand",
  });
  return [
    {
      mediaType: "product_front",
      imageUrl: url,
      sourcePageUrl: page,
      sourceDomain: validation.sourceDomain ?? "unknown",
      sourceType: "official_brand",
      sourceTier: 1,
      isOfficialSource: true,
      usageRightsStatus: resolveUsageRights("official_brand"),
      validationStatus: validation.status,
      isPrimary: true,
      displayOrder: 0,
      validationErrors: validation.errors,
    },
  ];
}

function buildUsageMedia(
  fixture: ProductAutomationFixture
): UsageMediaMetadataDraft[] {
  if (!fixture.usageMediaUrl) return [];
  return [
    {
      mediaType: "video",
      sourceUrl: fixture.usageMediaUrl,
      rightsStatus: "unknown",
      reviewStatus: "needs_review",
      productMatchVerified: false,
      applicationDemonstrationVerified: false,
      containsMedicalClaim: false,
      isSponsored: false,
    },
  ];
}

function buildFieldVerification(
  fixture: ProductAutomationFixture,
  hasIngredients: boolean,
  hasOffer: boolean,
  hasImage: boolean
): FieldVerificationMap {
  const live = fixture.evidence.some((e) => e.liveVerified);
  const status = live ? "verified" : "unverified";
  return {
    brand: { status, sourceUrl: fixture.evidence[0]?.sourceUrl },
    product_name: { status, sourceUrl: fixture.evidence[0]?.sourceUrl },
    inci: {
      status: hasIngredients ? status : "missing",
      sourceUrl: fixture.evidence[0]?.sourceUrl,
      note: live ? undefined : "fixture_or_unverified_source",
    },
    image: { status: hasImage ? status : "missing" },
    offer: { status: hasOffer ? status : "missing" },
  };
}

function processFixture(
  fixture: ProductAutomationFixture,
  priorProducts: ProductAutomationFixture[]
): ProductAutomationCandidate {
  const category = String(
    fixture.product.categoryCanonical || fixture.product.categoryRaw || "unknown"
  );
  const attrs = extractCategoryAttributes(fixture.product);
  const domain = resolveDomainForExtractor(attrs.extractorId, category);
  const ingredients = parseFixtureIngredients(fixture);
  const productValidation = validateStagingProduct(fixture.product);
  const offerResults = fixture.offers.map((o) => validateStagingOffer(o));
  // Keep structurally usable offers; source_unverified → needs_review, not dropped.
  const validOffers = fixture.offers.filter(
    (_, i) => offerResults[i]?.status !== "invalid"
  );
  const images = buildImages(fixture);
  const usageMedia = buildUsageMedia(fixture);

  const variants = [];
  if (fixture.product.sizeValue != null) {
    variants.push(
      validateSizeVariant({
        sizeValue: fixture.product.sizeValue,
        sizeUnit: fixture.product.sizeUnit,
      })
    );
  }
  if (attrs.extractorId === "lip" && (fixture.product.shadeFamily || attrs.shadeFamily)) {
    variants.push(
      validateShadeVariant({
        shadeName: fixture.product.shadeFamily ?? attrs.shadeFamily,
        hasSwatchImage: images.length > 0,
        ingredientScope: "unknown",
      })
    );
  }

  let dedupe = null as ReturnType<typeof compareProductIdentity> | null;
  let duplicateGroupId: string | null = null;
  for (const prior of priorProducts) {
    if (prior.fixtureId === fixture.fixtureId) continue;
    const match = compareProductIdentity(fixture.product, prior.product);
    if (match.kind === "exact_duplicate" || match.kind === "same_product_different_size") {
      dedupe = match;
      const left = buildProductIdentity(fixture.product);
      duplicateGroupId = hashId([left.brandKey, left.nameKey]);
      break;
    }
    if (match.kind === "renewal_suspect" && match.confidence >= 0.8) {
      dedupe = match;
      const left = buildProductIdentity(fixture.product);
      duplicateGroupId = hashId([left.brandKey, left.nameKey, "renewal"]);
      break;
    }
  }

  const hasIngredients = ingredients.tokens.length > 0;
  const hasOffer = validOffers.length > 0;
  const hasImage =
    images.length > 0 && images.every((i) => i.validationStatus !== "broken");
  const liveOfficial = fixture.evidence.some((e) => e.liveVerified);
  const completeness = completenessScore({
    hasBrand: Boolean(fixture.product.brandCanonical || fixture.product.brandRaw),
    hasName: Boolean(fixture.product.productNameRaw),
    hasCategory: Boolean(category && category !== "unknown"),
    hasIngredients,
    hasImage,
    hasOffer,
    hasEvidence: fixture.evidence.length > 0,
    hasSize: fixture.product.sizeValue != null,
  });

  const reviewReasons: string[] = [];
  if (!productValidation.ok) reviewReasons.push(...productValidation.errors);
  for (const r of offerResults) {
    if (!r.ok) reviewReasons.push(...r.errors.map((e) => `offer:${e}`));
  }
  if (!liveOfficial) reviewReasons.push("official_source_not_live_verified");
  if (dedupe?.kind === "exact_duplicate") reviewReasons.push("exact_duplicate");
  if (dedupe?.kind === "same_product_different_size") {
    reviewReasons.push("size_variant_group");
  }
  if (usageMedia.some((m) => m.reviewStatus !== "approved")) {
    reviewReasons.push("usage_media_needs_review");
  }
  if (attrs.rawHints.includes("functional_claim_unverified")) {
    reviewReasons.push("functional_claim_unverified");
  }

  const quality = classifyCatalogQualityStatus({
    blockedByPolicy: false,
    isDuplicate: dedupe?.kind === "exact_duplicate",
    discontinued: false,
    unavailable: false,
    sourceVerified: liveOfficial,
    hasIngredients,
    hasImage,
    hasOffer,
    needsReview: !liveOfficial || reviewReasons.length > 0,
    reasons: reviewReasons,
  });

  const eligibility = mapEligibility({
    quality,
    completeness,
    liveOfficial,
    hasIngredients,
    hasOffer,
  });
  const reviewStatus = mapReviewStatus(quality, eligibility);

  const refreshPlan = getCatalogRefreshPlan({
    disposition:
      quality === "duplicate"
        ? "duplicate"
        : reviewStatus === "needs_review" || reviewStatus === "blocked"
          ? "needs_review"
          : "auto_register",
    officialSourceConfirmed: liveOfficial,
    hasFullInci: hasIngredients,
    hasImage,
    hasRetailer: hasOffer,
  });

  const sourceConfidence = liveOfficial
    ? 0.9
    : fixture.evidence.some((e) => e.isOfficialBrandSource)
      ? 0.55
      : 0.3;

  return {
    candidateId: fixture.fixtureId,
    stageReached: "refresh_scheduling",
    domain,
    category,
    extractorId: attrs.extractorId,
    regulatoryClass: "general_cosmetic",
    product: fixture.product,
    ingredients,
    offers: validOffers,
    variants,
    images,
    usageMedia,
    evidence: fixture.evidence,
    fieldVerification: buildFieldVerification(
      fixture,
      hasIngredients,
      hasOffer,
      hasImage
    ),
    categoryAttributes: attrs,
    dedupe,
    duplicateGroupId,
    sourceConfidence,
    dataCompleteness: completeness,
    eligibility,
    qualityStatus: quality,
    reviewStatus,
    reviewReasons: [...new Set(reviewReasons)],
    refreshPlan,
    isFixture: true,
    autoPromote: false,
  };
}

function adminPriority(
  candidate: ProductAutomationCandidate
): "critical" | "high" | "medium" | "low" {
  if (candidate.reviewStatus === "blocked") return "critical";
  if (candidate.qualityStatus === "source_unverified") return "high";
  if (candidate.reviewStatus === "needs_review") return "high";
  if (candidate.reviewStatus === "duplicate_watch") return "medium";
  if (candidate.refreshPlan?.priority === "urgent") return "high";
  return "low";
}

export function createEmptyCheckpoint(runId: string, now = new Date()): ProductAutomationRunCheckpoint {
  const iso = now.toISOString();
  return {
    runId,
    startedAt: iso,
    updatedAt: iso,
    lastCompletedStageIndex: -1,
    processedCandidateIds: [],
    pendingCandidateIds: [],
    status: "running",
    failureReason: null,
  };
}

/**
 * Resume from a prior checkpoint. Re-processes only pending fixture ids.
 * Never mutates remote DB.
 */
export function resumeProductAutomationRun(input: {
  checkpoint: ProductAutomationRunCheckpoint;
  fixtures?: ProductAutomationFixture[];
  now?: Date;
}): ProductAutomationRunSummary {
  const fixtures = input.fixtures ?? PRODUCT_AUTOMATION_FIXTURES;
  const pending = new Set(
    input.checkpoint.pendingCandidateIds.length
      ? input.checkpoint.pendingCandidateIds
      : fixtures
          .map((f) => f.fixtureId)
          .filter((id) => !input.checkpoint.processedCandidateIds.includes(id))
  );
  const subset = fixtures.filter((f) => pending.has(f.fixtureId));
  return runProductAutomationDryRun({
    fixtures: subset,
    runId: input.checkpoint.runId,
    now: input.now,
    priorCheckpoint: input.checkpoint,
    allFixturesForDedupe: fixtures,
  });
}

export function runProductAutomationDryRun(input?: {
  fixtures?: ProductAutomationFixture[];
  runId?: string;
  now?: Date;
  priorCheckpoint?: ProductAutomationRunCheckpoint;
  allFixturesForDedupe?: ProductAutomationFixture[];
}): ProductAutomationRunSummary {
  const now = input?.now ?? new Date();
  const fixtures = input?.fixtures ?? PRODUCT_AUTOMATION_FIXTURES;
  const dedupeUniverse = input?.allFixturesForDedupe ?? fixtures;
  const runId =
    input?.runId ??
    `pa-${now.toISOString().slice(0, 10)}-${hashId([String(now.getTime())])}`;

  const candidates: ProductAutomationCandidate[] = [];
  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i]!;
    const priors = dedupeUniverse.filter((f) => f.fixtureId !== fixture.fixtureId);
    // Prefer earlier fixtures in the same run as prior for stable size-variant grouping.
    const orderedPriors = [
      ...fixtures.slice(0, i),
      ...priors.filter((p) => !fixtures.slice(0, i).some((x) => x.fixtureId === p.fixtureId)),
    ];
    candidates.push(processFixture(fixture, orderedPriors));
  }

  const processedIds = [
    ...(input?.priorCheckpoint?.processedCandidateIds ?? []),
    ...candidates.map((c) => c.candidateId),
  ];
  const allIds = (input?.allFixturesForDedupe ?? fixtures).map((f) => f.fixtureId);
  const pendingCandidateIds = allIds.filter((id) => !processedIds.includes(id));

  const checkpoint: ProductAutomationRunCheckpoint = {
    runId,
    startedAt: input?.priorCheckpoint?.startedAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    lastCompletedStageIndex: PRODUCT_INGESTION_STAGES.length - 1,
    processedCandidateIds: [...new Set(processedIds)],
    pendingCandidateIds,
    status: pendingCandidateIds.length ? "paused" : "completed",
    failureReason: null,
  };

  const totals = {
    discovered: candidates.length,
    withIngredients: candidates.filter((c) => (c.ingredients?.tokens.length ?? 0) > 0)
      .length,
    withOffers: candidates.filter((c) => c.offers.length > 0).length,
    withImages: candidates.filter((c) => c.images.length > 0).length,
    duplicates: candidates.filter(
      (c) =>
        c.dedupe?.kind === "exact_duplicate" ||
        c.dedupe?.kind === "same_product_different_size"
    ).length,
    needsReview: candidates.filter((c) => c.reviewStatus === "needs_review").length,
    recommendationReady: candidates.filter(
      (c) => c.eligibility === "recommendation_ready"
    ).length,
    stagingCandidates: candidates.filter(
      (c) =>
        c.reviewStatus === "staging_candidate" ||
        c.reviewStatus === "ready_for_admin" ||
        c.reviewStatus === "needs_review"
    ).length,
  };

  return {
    runId,
    mode: "fixture",
    generatedAt: now.toISOString(),
    stages: [...PRODUCT_INGESTION_STAGES],
    candidates,
    checkpoint,
    totals,
    adminQueueHints: candidates.map((c) => ({
      candidateId: c.candidateId,
      reviewStatus: c.reviewStatus,
      qualityStatus: c.qualityStatus,
      priority: adminPriority(c),
      reasons: c.reviewReasons,
    })),
  };
}

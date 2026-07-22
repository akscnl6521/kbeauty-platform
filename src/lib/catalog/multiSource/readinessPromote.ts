import type {
  IngredientEvidenceStatus,
  ImageEvidence,
  OfferEvidence,
  ProductReadinessState,
  SourceEvidence,
} from "./types";

export type ReadinessPromoteInput = {
  ingredientStatus: IngredientEvidenceStatus;
  ingredientMismatches?: string[];
  images: ImageEvidence[];
  offers: OfferEvidence[];
  sourceEvidences?: SourceEvidence[];
  hasIdentity: boolean;
  criticalConflict?: boolean;
  unavailable?: boolean;
};

export type ReadinessPromoteResult = {
  readiness: ProductReadinessState;
  rejectionReason: string | null;
};

function hasUsableImage(images: ImageEvidence[]): boolean {
  return images.some(
    (img) =>
      typeof img.imageUrl === "string" &&
      img.imageUrl.startsWith("http") &&
      img.isOfficialSource !== false
  );
}

function hasUsableOffer(offers: OfferEvidence[]): boolean {
  return offers.some(
    (o) =>
      typeof o.purchaseUrl === "string" &&
      o.purchaseUrl.startsWith("http") &&
      o.sourceVerified
  );
}

/**
 * Pure readiness promotion from merged evidences.
 *
 * Rules:
 * - unavailable when flagged
 * - ingredient needs_review → review_required
 * - critical conflict → review_required
 * - recommendation_ready only when ingredient verified|cross_source_confirmed
 *   AND usable official image AND verified offer AND identity
 * - source_verified_candidate (+ optional image/offer) → ingredient_candidate
 * - ingredient_incomplete without stronger evidence stays incomplete path:
 *   identity+offer/image → catalog_ready; else trend_candidate
 */
export function promoteReadiness(
  input: ReadinessPromoteInput
): ReadinessPromoteResult {
  if (input.unavailable) {
    return {
      readiness: "unavailable",
      rejectionReason: "Marked unavailable (SKU/regional unresolvable).",
    };
  }

  if (input.criticalConflict) {
    return {
      readiness: "review_required",
      rejectionReason: "Critical source/SKU conflict requires human review.",
    };
  }

  if (input.ingredientStatus === "needs_review") {
    return {
      readiness: "review_required",
      rejectionReason:
        input.ingredientMismatches?.join("; ") ||
        "Ingredient evidence needs_review.",
    };
  }

  const imageOk = hasUsableImage(input.images);
  const offerOk = hasUsableOffer(input.offers);
  const identityOk = input.hasIdentity;

  if (
    identityOk &&
    (input.ingredientStatus === "verified" ||
      input.ingredientStatus === "cross_source_confirmed") &&
    imageOk &&
    offerOk
  ) {
    return { readiness: "recommendation_ready", rejectionReason: null };
  }

  if (input.ingredientStatus === "source_verified_candidate") {
    return {
      readiness: "ingredient_candidate",
      rejectionReason: !imageOk
        ? "INCI candidate; official image pack incomplete."
        : !offerOk
          ? "INCI candidate; verified offer incomplete."
          : "INCI source_verified_candidate only — not yet recommendation_ready.",
    };
  }

  if (
    input.ingredientStatus === "verified" ||
    input.ingredientStatus === "cross_source_confirmed"
  ) {
    return {
      readiness: "ingredient_candidate",
      rejectionReason: !imageOk
        ? "INCI verified; official image missing for recommendation_ready."
        : !offerOk
          ? "INCI verified; offer missing for recommendation_ready."
          : "Identity incomplete for recommendation_ready.",
    };
  }

  // ingredient_incomplete path
  if (identityOk && (offerOk || imageOk)) {
    return {
      readiness: "catalog_ready",
      rejectionReason: "Identity + PDP/offer/image; INCI not verified.",
    };
  }

  if (identityOk) {
    return {
      readiness: "trend_candidate",
      rejectionReason: "Identity only; catalog/INCI package incomplete.",
    };
  }

  return {
    readiness: "trend_candidate",
    rejectionReason: "Insufficient identity and evidence.",
  };
}

/**
 * Autonomous product verification gate (pure).
 * Never auto-publishes. Activation is separate from recommendation eligibility.
 */

export type ProductQualityGrade =
  | "A"
  | "B"
  | "C"
  | "D"
  | "Review Required";

export type ProductVerifyGateInput = {
  /** Current products.active */
  active: boolean | null;
  verifiedAt: string | null;
  qualityGrade: ProductQualityGrade;
  allowedGrades: ProductQualityGrade[];
  hasOfficialIngredientsText: boolean;
  /**
   * 전성분 문자열이 **실제 성분표 형태인가** (`validateIngredientList`).
   *
   * 텍스트가 «있다» 는 것만으로는 부족하다. 2026-07-29·07-30 두 번, 추출기가
   * 페이지 문구를 전성분으로 저장했다(`email-only` · `#HIGH-CONCENTRATION` ·
   * 자바스크립트 배열 통째로). 전성분은 알레르겐 필터의 입력이라, 쓰레기가 들어간
   * 채로 활성화되면 «알레르겐 없음 = 안전» 이라는 잘못된 판정이 사용자에게 나간다.
   *
   * 데이터 정리로는 재발을 못 막는다. **게이트에서 막아야** 구조적으로 끝난다.
   */
  ingredientsTextValid: boolean;
  /** Official-sourced structured rows (pending or approved) */
  structuredOfficialIngredientCount: number;
  ambiguousIngredientCount: number;
  unmatchedIngredientCount: number;
  safetyConflict: boolean;
  /** verified + in_stock + price + currency + shipping */
  verifiedInStockOfferCount: number;
  /** At least one country with eligible verified offer */
  countryEligibleOfferCount: number;
  allowPublish: boolean;
  allowProductDemotion: boolean;
};

export type ProductVerifyGateResult = {
  canAutoVerify: boolean;
  canActivate: boolean;
  alreadyActiveVerified: boolean;
  needsReview: boolean;
  blockers: string[];
  reasons: string[];
  /** Same outcome as current DB state — skip writes */
  skipAsUnchanged: boolean;
};

/**
 * Auto-verify only high-confidence draft catalog rows.
 */
export function evaluateProductVerificationGate(
  input: ProductVerifyGateInput
): ProductVerifyGateResult {
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (input.allowPublish) {
    blockers.push("allowPublish_must_be_false");
  }
  if (input.allowProductDemotion) {
    blockers.push("allowProductDemotion_must_be_false");
  }
  if (!input.allowedGrades.includes(input.qualityGrade)) {
    blockers.push(`quality_grade_${input.qualityGrade}`);
  }
  if (!input.hasOfficialIngredientsText) {
    blockers.push("official_ingredients_text_missing");
  }
  if (input.hasOfficialIngredientsText && !input.ingredientsTextValid) {
    blockers.push("official_ingredients_text_invalid");
  }
  if (input.structuredOfficialIngredientCount < 1) {
    blockers.push("structured_ingredients_missing");
  }
  if (input.ambiguousIngredientCount > 0) {
    blockers.push("ingredient_ambiguity");
  }
  if (input.unmatchedIngredientCount > 0) {
    blockers.push("ingredient_unmatched");
  }
  if (input.safetyConflict) {
    blockers.push("safety_conflict");
  }
  if (input.verifiedInStockOfferCount < 1) {
    blockers.push("verified_offer_missing");
  }
  if (input.countryEligibleOfferCount < 1) {
    blockers.push("country_eligible_offer_missing");
  }

  const canAutoVerify = blockers.length === 0;
  const canActivate = canAutoVerify;
  const alreadyActiveVerified =
    input.active === true && Boolean(input.verifiedAt);

  if (canAutoVerify) {
    reasons.push("product_verify_gate_pass");
  }

  const needsReview =
    !canAutoVerify &&
    (blockers.includes("ingredient_ambiguity") ||
      blockers.includes("safety_conflict") ||
      blockers.includes("quality_grade_C") ||
      blockers.includes("quality_grade_D") ||
      blockers.includes("quality_grade_Review Required") ||
      blockers.includes("country_eligible_offer_missing") ||
      blockers.includes("verified_offer_missing") ||
      blockers.includes("structured_ingredients_missing") ||
      blockers.includes("official_ingredients_text_missing") ||
      blockers.includes("official_ingredients_text_invalid") ||
      blockers.includes("ingredient_unmatched"));

  const skipAsUnchanged =
    alreadyActiveVerified &&
    canAutoVerify &&
    input.active === true &&
    Boolean(input.verifiedAt);

  return {
    canAutoVerify,
    canActivate,
    alreadyActiveVerified,
    needsReview,
    blockers,
    reasons,
    skipAsUnchanged,
  };
}

/**
 * Stale / OOS offers never demote an already-verified product.
 * Eligibility is computed separately and may become false.
 */
export function shouldDemoteVerifiedProduct(_input: {
  hadVerifiedOffers: boolean;
  nowHasEligibleOffers: boolean;
  allowProductDemotion: boolean;
}): boolean {
  return false;
}

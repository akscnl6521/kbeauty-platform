/**
 * Face-identity verification for the fixed brand model (kbm-main-model).
 * Pure — no network, no DB, no image decoding.
 *
 * What this is, precisely: the *rules* for deciding whether a generated frame
 * shows the same model as the reference set, plus the shape of the verdict that
 * gets recorded. It does not look at pixels — there is no face-embedding model
 * available here, so the per-feature comparison is made by a reviewer looking at
 * the candidate frame beside the reference stills.
 *
 * The value is that the judgement becomes repeatable and recorded rather than a
 * one-off impression: the same nine locked features every time, an explicit
 * verdict, and "I could not tell" kept separate from "it matches".
 *
 * The feature list is not invented here — it is the identity-lock clause of the
 * prompt the references were generated with (see manifest.json).
 */

/** The nine traits the fixed prompt requires to stay constant. */
export const IDENTITY_FEATURES = [
  "눈매",
  "눈동자 색",
  "눈썹 형태",
  "코의 길이와 폭",
  "입술 모양",
  "턱선",
  "얼굴형",
  "피부톤",
  "헤어라인",
] as const;

export type IdentityFeature = (typeof IDENTITY_FEATURES)[number];

/**
 * Drift the prompt explicitly forbids. These are scored separately because a
 * frame can keep every feature "similar" while still having quietly slimmed the
 * jaw or enlarged the eyes — the exact failure the prompt was written against.
 */
export const FORBIDDEN_DRIFT = [
  "다른 사람처럼 바뀜",
  "눈을 과도하게 키움",
  "코를 지나치게 높이거나 좁힘",
  "턱을 지나치게 뾰족하게 만듦",
  "연령대나 얼굴 비율 변경",
] as const;

export type ForbiddenDrift = (typeof FORBIDDEN_DRIFT)[number];

/** A reviewer's call on one feature. */
export type FeatureCall = "match" | "mismatch" | "unclear";

export type IdentityCheckInput = {
  /** Which reference stills the candidate was compared against. */
  referenceFiles: readonly string[];
  /** The frame being judged. */
  candidateLabel: string;
  features: Partial<Record<IdentityFeature, FeatureCall>>;
  /** Drift observed; absent means none seen. */
  drift?: readonly ForbiddenDrift[];
};

export type IdentityVerdict = {
  verdict: "pass" | "fail" | "inconclusive";
  reasonCodes: string[];
  mismatched: IdentityFeature[];
  unclear: IdentityFeature[];
  missing: IdentityFeature[];
  drift: ForbiddenDrift[];
};

/**
 * Decide identity match.
 *
 * Fails closed on purpose:
 *   - any forbidden drift  → fail, whatever the features say
 *   - any feature mismatch → fail
 *   - any feature unclear or unrecorded → inconclusive, never a pass
 *
 * "Inconclusive" is a distinct outcome because a frame too blurry or too
 * off-angle to judge is not a frame that passed; treating it as a pass is how a
 * drifting face gets through.
 */
export function evaluateIdentityCheck(
  input: IdentityCheckInput
): IdentityVerdict {
  const reasonCodes: string[] = [];
  const mismatched: IdentityFeature[] = [];
  const unclear: IdentityFeature[] = [];
  const missing: IdentityFeature[] = [];

  for (const feature of IDENTITY_FEATURES) {
    const call = input.features[feature];
    if (call === undefined) missing.push(feature);
    else if (call === "mismatch") mismatched.push(feature);
    else if (call === "unclear") unclear.push(feature);
  }

  const drift = [...(input.drift ?? [])];

  if (input.referenceFiles.length === 0) {
    reasonCodes.push("no_reference_compared");
  }
  if (drift.length > 0) reasonCodes.push("forbidden_drift");
  if (mismatched.length > 0) reasonCodes.push("feature_mismatch");
  if (unclear.length > 0) reasonCodes.push("feature_unclear");
  if (missing.length > 0) reasonCodes.push("feature_not_assessed");

  let verdict: IdentityVerdict["verdict"];
  if (drift.length > 0 || mismatched.length > 0) {
    verdict = "fail";
  } else if (
    unclear.length > 0 ||
    missing.length > 0 ||
    input.referenceFiles.length === 0
  ) {
    verdict = "inconclusive";
  } else {
    verdict = "pass";
  }

  return { verdict, reasonCodes, mismatched, unclear, missing, drift };
}

/**
 * How many reference stills a frame should be compared against.
 *
 * One is not enough: the reference set spans a full profile through to straight
 * front, and a generated frame at some intermediate angle can look right beside
 * one still and wrong beside another. Three keeps at least one nearby angle in
 * the comparison.
 */
export const MIN_REFERENCES_PER_CHECK = 3;

export function hasEnoughReferences(referenceFiles: readonly string[]): boolean {
  return referenceFiles.length >= MIN_REFERENCES_PER_CHECK;
}

/**
 * The single closing notice every tutorial video carries.
 *
 * Deliberately one short line. It is defined here so every video in the series
 * uses the identical wording rather than a paraphrase drifting per clip.
 */
export const CLOSING_NOTICE_KO = "이상 반응이 있으면 사용을 중단하세요.";

/** §36.3 on-screen label for AI-generated content. */
export const AI_CONTENT_LABEL_KO = "AI 생성 콘텐츠";

export type VideoOverlayRequirements = {
  closingNotice: string;
  aiLabel: string;
  /** The AI label must be readable for the whole clip, not just at the end. */
  aiLabelPersistent: true;
};

export function videoOverlayRequirements(): VideoOverlayRequirements {
  return {
    closingNotice: CLOSING_NOTICE_KO,
    aiLabel: AI_CONTENT_LABEL_KO,
    aiLabelPersistent: true,
  };
}

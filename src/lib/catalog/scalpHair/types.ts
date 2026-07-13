/**
 * Scalp / hair domain model (non-diagnostic).
 * Separate from face skincare rankProducts concerns.
 */

export type ScalpType =
  | "dry"
  | "oily"
  | "combination"
  | "sensitive"
  | "normal"
  | "unknown";

export type ScalpConcern =
  | "excess_oil"
  | "dryness_tightness"
  | "dandruff"
  | "flaking"
  | "itching"
  | "odor"
  | "redness"
  | "bumps"
  | "heat_sensation"
  | "buildup"
  | "unknown";

export type HairType =
  | "fine"
  | "medium"
  | "thick"
  | "straight"
  | "wavy"
  | "curly"
  | "coily"
  | "unknown";

export type HairConcern =
  | "dryness"
  | "frizz"
  | "tangling"
  | "breakage"
  | "split_ends"
  | "damage"
  | "color_treated"
  | "bleached"
  | "low_volume"
  | "heat_damage"
  | "dullness"
  | "unknown";

export type HairLossPattern =
  | "diffuse_shedding"
  | "crown_thinning"
  | "receding_hairline"
  | "widening_part"
  | "patchy_loss"
  | "hair_thinning"
  | "breakage"
  | "unknown";

export type HairLossOnset = "sudden" | "gradual" | "recurrent" | "unknown";

export type ScalpSymptom =
  | "itching"
  | "redness"
  | "burning"
  | "pain"
  | "dandruff"
  | "flaking"
  | "bumps"
  | "crusting"
  | "oozing"
  | "bleeding"
  | "none";

export type HairLossObservation = {
  patterns: HairLossPattern[];
  onset?: HairLossOnset;
  duration?: string;
  scalpSymptoms: ScalpSymptom[];
  recentTriggers: string[];
  familyHistory?: boolean;
};

export type HairLossSafetyLevel =
  | "cosmetic_support"
  | "professional_consultation"
  | "urgent_check";

export type HairLossSafetyAssessment = {
  level: HairLossSafetyLevel;
  reasons: string[];
  /** User-facing guidance — never diagnoses a disease. */
  userMessageKo: string;
};

const URGENT_SYMPTOMS = new Set<ScalpSymptom>([
  "oozing",
  "bleeding",
  "crusting",
]);

const PROFESSIONAL_SYMPTOMS = new Set<ScalpSymptom>([
  "pain",
  "burning",
  "redness",
  "itching",
  "dandruff",
  "flaking",
  "bumps",
]);

/**
 * Non-diagnostic safety triage for hair-loss observations.
 * Does not emit disease names or treatment guarantees.
 */
export function assessHairLossObservationSafety(
  observation: HairLossObservation | null | undefined
): HairLossSafetyAssessment {
  if (!observation) {
    return {
      level: "cosmetic_support",
      reasons: ["no_observation"],
      userMessageKo:
        "입력하신 내용만으로 원인을 판단할 수는 없습니다. 두피·모발 관리 정보는 참고용이며 진단이 아닙니다.",
    };
  }

  const patterns = Array.isArray(observation.patterns)
    ? observation.patterns
    : [];
  const symptoms = Array.isArray(observation.scalpSymptoms)
    ? observation.scalpSymptoms
    : [];
  const onset = observation.onset ?? "unknown";
  const reasons: string[] = [];

  const hasUrgentSymptom = symptoms.some((s) => URGENT_SYMPTOMS.has(s));
  const hasSeverePain = symptoms.includes("pain") && onset === "sudden";
  const hasPatchy = patterns.includes("patchy_loss");
  const hasSuddenWide =
    onset === "sudden" &&
    (patterns.includes("diffuse_shedding") ||
      patterns.includes("hair_thinning") ||
      patterns.includes("crown_thinning") ||
      patterns.includes("widening_part"));

  if (hasUrgentSymptom) {
    reasons.push("oozing_bleeding_or_crusting");
  }
  if (hasSeverePain) {
    reasons.push("sudden_pain");
  }
  if (hasSuddenWide && hasUrgentSymptom) {
    reasons.push("sudden_wide_loss_with_urgent_symptoms");
  }

  if (reasons.length > 0 || (hasUrgentSymptom && hasSuddenWide)) {
    return {
      level: "urgent_check",
      reasons: reasons.length ? reasons : ["urgent_scalp_signals"],
      userMessageKo:
        "입력하신 내용만으로 원인을 판단할 수는 없습니다. 진물·출혈·딱지, 갑작스러운 넓은 부분 탈락이 동반되면 샴푸 선택보다 전문가 상담을 먼저 고려하세요.",
    };
  }

  if (hasPatchy) reasons.push("patchy_loss");
  if (
    onset === "sudden" &&
    (patterns.includes("hair_thinning") ||
      patterns.includes("crown_thinning") ||
      patterns.includes("widening_part") ||
      patterns.includes("diffuse_shedding"))
  ) {
    reasons.push("sudden_visible_thinning");
  }
  if (
    (patterns.includes("widening_part") || patterns.includes("crown_thinning")) &&
    (observation.duration?.includes("month") ||
      observation.duration?.includes("개월") ||
      observation.duration === "ongoing")
  ) {
    reasons.push("persistent_part_or_crown_thinning");
  }
  if (
    symptoms.some((s) => PROFESSIONAL_SYMPTOMS.has(s) && s !== "none") &&
    (patterns.includes("diffuse_shedding") ||
      patterns.includes("hair_thinning") ||
      hasPatchy)
  ) {
    reasons.push("scalp_symptoms_with_hair_loss");
  }
  if (
    (symptoms.includes("pain") || symptoms.includes("burning")) &&
    patterns.some((p) => p !== "unknown" && p !== "breakage")
  ) {
    reasons.push("pain_or_burning_with_hair_loss");
  }

  if (reasons.length > 0) {
    return {
      level: "professional_consultation",
      reasons,
      userMessageKo:
        "입력하신 내용만으로 원인을 판단할 수는 없습니다. 갑작스럽거나 부분적으로 빠지는 양상, 통증·진물·출혈이 동반되면 샴푸 선택보다 전문가 상담을 먼저 고려하세요.",
    };
  }

  return {
    level: "cosmetic_support",
    reasons: ["no_priority_red_flags"],
    userMessageKo:
      "입력하신 내용만으로 원인을 판단할 수는 없습니다. 두피·모발 관리 제품 정보는 참고용이며, 치료·발모·완치를 보장하지 않습니다.",
  };
}

export function forbidsHairLossTreatmentLanguage(text: string): boolean {
  return /탈모\s*치료|발모\s*보장|완치|치료제|발모제|질환명|원형탈모|지루성피부염/.test(
    text
  );
}

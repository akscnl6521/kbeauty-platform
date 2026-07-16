/**
 * 붉은기 관찰 상태 (비진단).
 * 사용자 자가 보고만 수집 — 질환명 추정·진단에 쓰지 않는다.
 */

import type { ManagementLevel, Recommendation } from "@/lib/recommend/types";

export type RednessTrigger =
  | "sun_exposure"
  | "heat_or_exercise"
  | "after_cosmetic"
  | "after_cleansing"
  | "around_breakouts"
  | "recurrent_unknown"
  | "persistent"
  | "unknown";

export type RednessSymptom =
  | "burning"
  | "stinging"
  | "itching"
  | "dryness_tightness"
  | "flaking"
  | "swelling"
  | "visible_capillaries"
  | "none";

export type RednessDuration =
  | "under_one_hour"
  | "several_hours"
  | "over_one_day"
  | "recurrent"
  | "persistent"
  | "unknown";

export type RednessArea =
  | "cheeks"
  | "nose"
  | "forehead"
  | "chin"
  | "eye_area"
  | "whole_face";

export type RednessObservation = {
  trigger?: RednessTrigger;
  symptoms?: RednessSymptom[];
  duration?: RednessDuration;
  areas?: RednessArea[];
};

export const REDNESS_TRIGGERS: readonly RednessTrigger[] = [
  "sun_exposure",
  "heat_or_exercise",
  "after_cosmetic",
  "after_cleansing",
  "around_breakouts",
  "recurrent_unknown",
  "persistent",
  "unknown",
] as const;

export const REDNESS_SYMPTOMS: readonly RednessSymptom[] = [
  "burning",
  "stinging",
  "itching",
  "dryness_tightness",
  "flaking",
  "swelling",
  "visible_capillaries",
  "none",
] as const;

export const REDNESS_DURATIONS: readonly RednessDuration[] = [
  "under_one_hour",
  "several_hours",
  "over_one_day",
  "recurrent",
  "persistent",
  "unknown",
] as const;

export const REDNESS_AREAS: readonly RednessArea[] = [
  "cheeks",
  "nose",
  "forehead",
  "chin",
  "eye_area",
  "whole_face",
] as const;

export const REDNESS_TRIGGER_LABEL_KO: Record<RednessTrigger, string> = {
  sun_exposure: "햇빛에 오래 노출된 뒤",
  heat_or_exercise: "더운 환경·운동·사우나 뒤",
  after_cosmetic: "화장품 사용 후",
  after_cleansing: "세안 후",
  around_breakouts: "여드름이나 트러블 주변",
  recurrent_unknown: "이유 없이 반복됨",
  persistent: "항상 붉은 편",
  unknown: "잘 모르겠음",
};

export const REDNESS_SYMPTOM_LABEL_KO: Record<RednessSymptom, string> = {
  burning: "화끈거림",
  stinging: "따가움",
  itching: "가려움",
  dryness_tightness: "건조함·당김",
  flaking: "각질",
  swelling: "부기",
  visible_capillaries: "실핏줄이 보임",
  none: "특별한 증상 없음",
};

export const REDNESS_DURATION_LABEL_KO: Record<RednessDuration, string> = {
  under_one_hour: "1시간 이내",
  several_hours: "몇 시간",
  over_one_day: "하루 이상",
  recurrent: "반복적으로 나타남",
  persistent: "계속 유지됨",
  unknown: "잘 모르겠음",
};

export const REDNESS_AREA_LABEL_KO: Record<RednessArea, string> = {
  cheeks: "볼",
  nose: "코",
  forehead: "이마",
  chin: "턱",
  eye_area: "눈가",
  whole_face: "얼굴 전체",
};

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function uniquePreserve<T>(items: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** 요청/저장용 정규화. 유효 필드가 하나도 없으면 null. */
export function parseRednessObservation(
  raw: unknown
): RednessObservation | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const out: RednessObservation = {};

  if (isOneOf(row.trigger, REDNESS_TRIGGERS)) {
    out.trigger = row.trigger;
  }

  const symptomsRaw = row.symptoms ?? row.redness_symptoms;
  if (Array.isArray(symptomsRaw)) {
    const symptoms = uniquePreserve(
      symptomsRaw.filter((s): s is RednessSymptom =>
        isOneOf(s, REDNESS_SYMPTOMS)
      )
    );
    // "특별한 증상 없음"과 다른 증상 동시 선택 시 none만 유지
    if (symptoms.includes("none") && symptoms.length > 1) {
      out.symptoms = ["none"];
    } else if (symptoms.length > 0) {
      out.symptoms = symptoms;
    }
  }

  if (isOneOf(row.duration, REDNESS_DURATIONS)) {
    out.duration = row.duration;
  }

  const areasRaw = row.areas ?? row.redness_areas;
  if (Array.isArray(areasRaw)) {
    let areas = uniquePreserve(
      areasRaw.filter((a): a is RednessArea => isOneOf(a, REDNESS_AREAS))
    );
    if (areas.includes("whole_face") && areas.length > 1) {
      areas = ["whole_face"];
    }
    if (areas.length > 0) out.areas = areas;
  }

  if (
    out.trigger == null &&
    (!out.symptoms || out.symptoms.length === 0) &&
    out.duration == null &&
    (!out.areas || out.areas.length === 0)
  ) {
    return null;
  }

  return out;
}

export function hasRednessObservation(
  value: RednessObservation | null | undefined
): boolean {
  return parseRednessObservation(value) != null;
}

/** 지속·반복 + 화끈/부기/실핏줄 등 관찰 시 상담 우선 여부 (비진단) */
export function isRednessCounselingPriority(
  observation: RednessObservation | null | undefined
): boolean {
  const parsed = parseRednessObservation(observation);
  if (!parsed) return false;

  const persistentContext =
    parsed.duration === "persistent" ||
    parsed.duration === "recurrent" ||
    parsed.trigger === "persistent" ||
    parsed.trigger === "recurrent_unknown";

  const cautionSymptoms = (parsed.symptoms ?? []).some((s) =>
    s === "burning" || s === "swelling" || s === "visible_capillaries"
  );

  return persistentContext && cautionSymptoms;
}

const COUNSEL_REASON_KO =
  "입력하신 관찰(지속·반복되는 붉어 보임과 화끈거림·부기·실핏줄 등)만으로는 화장품만으로 판단하기 어렵습니다. 제품 구매보다 전문가 상담을 먼저 고려해 주세요.";
const COUNSEL_REASON_EN =
  "Based only on the self-reported observations (ongoing or recurring visible redness with burning, swelling, or visible capillaries), cosmetics alone may not be enough. Consider professional advice before shopping.";
const COUNSEL_NOT_REC_KO =
  "지금은 새 제품 구매를 권하지 않습니다. 관찰된 상태는 참고 정보이며 원인을 진단한 결과가 아닙니다.";
const COUNSEL_LIMIT_KO =
  "지속·반복되는 붉어 보이는 상태와 동반 증상은 화장품 루틴만으로 해결된다고 말하기 어렵습니다.";

/**
 * 관찰값을 recommendation에 붙이고, 위험 관찰 시 상담 우선으로 조정.
 * rankProducts / 성분 목록은 바꾸지 않는다. 질환명 없음.
 */
export function applyRednessObservationToRecommendation(
  recommendation: Recommendation,
  observation: RednessObservation | null | undefined
): Recommendation {
  const parsed = parseRednessObservation(observation);
  if (!parsed) {
    // 명시적으로 비어 있으면 과거 필드 제거하지 않음 — 호출측에서 새 분석만 전달
    return recommendation;
  }

  let next: Recommendation = {
    ...recommendation,
    rednessObservation: parsed,
  };

  if (!isRednessCounselingPriority(parsed)) {
    return next;
  }

  const expertReferralReasons = uniquePreserve([
    ...(next.expertReferralReasons ?? []),
    COUNSEL_REASON_KO,
  ]);
  const notRecommendedReasons = uniquePreserve([
    ...(next.notRecommendedReasons ?? []),
    COUNSEL_NOT_REC_KO,
  ]);
  const cosmeticLimitations = uniquePreserve([
    ...(next.cosmeticLimitations ?? []),
    COUNSEL_LIMIT_KO,
  ]);

  const currentLevel = next.managementLevel ?? "cosmetic_care";
  const elevated: ManagementLevel =
    currentLevel === "urgent_check" ? "urgent_check" : "expert_first";

  const summaryKoBase = (next.summaryKo ?? "").trim();
  const nonDiagnosis =
    "입력하신 내용은 붉어 보이는 피부 상태에 대한 참고 정보이며, 원인을 진단한 결과는 아닙니다.";
  const preferCounsel =
    "지금은 제품 구매보다 전문가 상담을 먼저 고려하는 것이 안전합니다.";

  let summaryKo = summaryKoBase;
  if (!summaryKo.includes("원인을 진단한 결과는 아닙니다")) {
    summaryKo = `${summaryKo ? `${summaryKo} ` : ""}${nonDiagnosis}`.trim();
  }
  if (!summaryKo.includes("제품 구매보다 전문가 상담")) {
    summaryKo = `${summaryKo} ${preferCounsel}`.trim();
  }

  next = {
    ...next,
    managementLevel: elevated,
    expertReferralReasons,
    notRecommendedReasons,
    cosmeticLimitations,
    summaryKo,
    summaryEn: next.summaryEn?.trim()
      ? next.summaryEn
      : COUNSEL_REASON_EN,
  };

  return next;
}

/** AI user text용 — 관찰 코드 + 한국어 라벨 (진단명 없음) */
export function formatRednessObservationForPrompt(
  observation: RednessObservation | null | undefined
): string | null {
  const parsed = parseRednessObservation(observation);
  if (!parsed) return null;

  const lines: string[] = [
    "User-observed redness context (optional; not a diagnosis):",
  ];
  if (parsed.trigger) {
    lines.push(
      `- redness_trigger: ${parsed.trigger} (${REDNESS_TRIGGER_LABEL_KO[parsed.trigger]})`
    );
  }
  if (parsed.symptoms && parsed.symptoms.length > 0) {
    lines.push(
      `- redness_symptoms: ${parsed.symptoms
        .map((s) => `${s} (${REDNESS_SYMPTOM_LABEL_KO[s]})`)
        .join(", ")}`
    );
  }
  if (parsed.duration) {
    lines.push(
      `- redness_duration: ${parsed.duration} (${REDNESS_DURATION_LABEL_KO[parsed.duration]})`
    );
  }
  if (parsed.areas && parsed.areas.length > 0) {
    lines.push(
      `- redness_areas: ${parsed.areas
        .map((a) => `${a} (${REDNESS_AREA_LABEL_KO[a]})`)
        .join(", ")}`
    );
  }
  lines.push(
    "- Treat these as self-reported observations only. Do NOT name or diagnose medical skin conditions.",
    "- Do NOT claim products can treat or cure redness.",
    "- If persistent redness with burning, swelling, or visible capillaries is reported, prefer observe/combined_care/expert_first over purchase push; fill expertReferralReasons when appropriate."
  );
  return lines.join("\n");
}

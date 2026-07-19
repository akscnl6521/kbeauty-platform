import type {
  BodyArea,
  ConcernObservation,
  RedFlag,
  SymptomDuration,
  SymptomSeverity,
} from "./types";
import type { RednessObservation } from "./rednessObservation";

type ConcernObservationDraft = {
  concern: string;
  areas?: BodyArea[];
  severity?: SymptomSeverity;
  duration?: SymptomDuration;
  worsening?: boolean;
  redFlags?: RedFlag[];
};

const REDNESS_AREA_MAP: Partial<Record<NonNullable<RednessObservation["areas"]>[number], BodyArea>> = {
  cheeks: "cheek",
  nose: "nose",
  forehead: "forehead",
  chin: "chin",
  eye_area: "eye_area",
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferRednessSeverity(observation?: RednessObservation): SymptomSeverity | undefined {
  const symptoms = observation?.symptoms ?? [];
  if (symptoms.includes("swelling") || symptoms.includes("burning")) return "severe";
  if (
    symptoms.includes("stinging") ||
    symptoms.includes("itching") ||
    symptoms.includes("visible_capillaries")
  ) {
    return "moderate";
  }
  if (symptoms.length > 0 && !symptoms.includes("none")) return "mild";
  return undefined;
}

function inferRednessDuration(observation?: RednessObservation): SymptomDuration | undefined {
  switch (observation?.duration) {
    case "under_one_hour":
      return "under_3_days";
    case "several_hours":
    case "over_one_day":
      return "under_2_weeks";
    case "recurrent":
      return "under_3_months";
    case "persistent":
      return "over_3_months";
    case "unknown":
      return "unknown";
    default:
      return undefined;
  }
}

function inferRednessRedFlags(observation?: RednessObservation): RedFlag[] | undefined {
  const symptoms = observation?.symptoms ?? [];
  const flags: RedFlag[] = [];
  if (symptoms.includes("swelling")) flags.push("rapid_swelling");
  if ((observation?.areas ?? []).includes("eye_area") && symptoms.includes("stinging")) {
    flags.push("eye_irritation");
  }
  return flags.length > 0 ? unique(flags) : undefined;
}

function normalizeDraft(draft: ConcernObservationDraft): ConcernObservation {
  return {
    concern: draft.concern.trim(),
    ...(draft.areas && draft.areas.length > 0 ? { areas: unique(draft.areas) } : {}),
    ...(draft.severity ? { severity: draft.severity } : {}),
    ...(draft.duration ? { duration: draft.duration } : {}),
    ...(typeof draft.worsening === "boolean" ? { worsening: draft.worsening } : {}),
    ...(draft.redFlags && draft.redFlags.length > 0
      ? { redFlags: unique(draft.redFlags) }
      : {}),
  };
}

/**
 * /analyze 화면의 기존 고민 선택과 붉은기 상세 입력을
 * API의 concernObservations 계약으로 변환한다.
 *
 * 사용자가 직접 입력하지 않은 질환명이나 원인은 추정하지 않는다.
 */
export function buildConcernObservations(input: {
  concerns: string[];
  drafts?: Record<string, ConcernObservationDraft | undefined>;
  rednessObservation?: RednessObservation;
}): ConcernObservation[] {
  const concerns = unique(input.concerns.map((value) => value.trim()).filter(Boolean));

  return concerns.map((concern) => {
    const manual = input.drafts?.[concern];
    if (manual) return normalizeDraft({ ...manual, concern });

    if (concern !== "붉은기") {
      return { concern };
    }

    const redness = input.rednessObservation;
    const mappedAreas = unique(
      (redness?.areas ?? [])
        .map((area) => REDNESS_AREA_MAP[area])
        .filter((area): area is BodyArea => Boolean(area))
    );

    return normalizeDraft({
      concern,
      ...(mappedAreas.length > 0 ? { areas: mappedAreas } : {}),
      ...(inferRednessSeverity(redness)
        ? { severity: inferRednessSeverity(redness) }
        : {}),
      ...(inferRednessDuration(redness)
        ? { duration: inferRednessDuration(redness) }
        : {}),
      ...(redness?.duration === "recurrent" || redness?.duration === "persistent"
        ? { worsening: false }
        : {}),
      ...(inferRednessRedFlags(redness)
        ? { redFlags: inferRednessRedFlags(redness) }
        : {}),
    });
  });
}

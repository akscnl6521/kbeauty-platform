import { NextResponse } from "next/server";
import { AnalyzeSkinError, analyzeSkin } from "@/lib/ai/analyzeSkin";
import { normalizeIngredientTagList } from "@/lib/ai/prompt";
import { parseRednessObservation } from "@/lib/ai/rednessObservation";
import type {
  AnalyzeSkinErrorBody,
  AnalyzeSkinRequest,
  BodyArea,
  ConcernObservation,
  RedFlag,
  SymptomDuration,
  SymptomSeverity,
} from "@/lib/ai/types";
import { normalizeCurrentProducts } from "@/lib/recommend/currentProduct";

export const runtime = "nodejs";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const BODY_AREAS = new Set<BodyArea>([
  "forehead",
  "eye_area",
  "under_eye",
  "nose",
  "cheek",
  "mouth_area",
  "chin",
  "neck",
  "other",
]);

const SEVERITIES = new Set<SymptomSeverity>([
  "mild",
  "moderate",
  "severe",
]);

const DURATIONS = new Set<SymptomDuration>([
  "under_3_days",
  "under_2_weeks",
  "under_3_months",
  "over_3_months",
  "unknown",
]);

const RED_FLAGS = new Set<RedFlag>([
  "pain",
  "bleeding",
  "oozing",
  "rapid_swelling",
  "spreading_rash",
  "suspected_infection",
  "burn",
  "sudden_mole_change",
  "eye_irritation",
  "ear_internal_symptom",
  "breathing_difficulty",
  "systemic_allergy",
]);

function parseEnumArray<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  fieldName: string
): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new AnalyzeSkinError(
      `${fieldName} must be an array.`,
      400,
      "BAD_REQUEST"
    );
  }

  const normalized: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item as T)) {
      throw new AnalyzeSkinError(
        `${fieldName} contains an unsupported value.`,
        400,
        "BAD_REQUEST"
      );
    }
    if (!normalized.includes(item as T)) normalized.push(item as T);
  }
  return normalized;
}

function parseConcernObservations(value: unknown): ConcernObservation[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new AnalyzeSkinError(
      "concernObservations must be an array.",
      400,
      "BAD_REQUEST"
    );
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AnalyzeSkinError(
        `concernObservations[${index}] must be an object.`,
        400,
        "BAD_REQUEST"
      );
    }

    const row = item as Record<string, unknown>;
    if (!isNonEmptyString(row.concern)) {
      throw new AnalyzeSkinError(
        `concernObservations[${index}].concern is required.`,
        400,
        "BAD_REQUEST"
      );
    }

    const severity = row.severity;
    if (
      severity !== undefined &&
      (typeof severity !== "string" ||
        !SEVERITIES.has(severity as SymptomSeverity))
    ) {
      throw new AnalyzeSkinError(
        `concernObservations[${index}].severity is invalid.`,
        400,
        "BAD_REQUEST"
      );
    }

    const duration = row.duration;
    if (
      duration !== undefined &&
      (typeof duration !== "string" ||
        !DURATIONS.has(duration as SymptomDuration))
    ) {
      throw new AnalyzeSkinError(
        `concernObservations[${index}].duration is invalid.`,
        400,
        "BAD_REQUEST"
      );
    }

    if (row.worsening !== undefined && typeof row.worsening !== "boolean") {
      throw new AnalyzeSkinError(
        `concernObservations[${index}].worsening must be boolean.`,
        400,
        "BAD_REQUEST"
      );
    }

    return {
      concern: row.concern.trim(),
      ...(parseEnumArray(
        row.areas,
        BODY_AREAS,
        `concernObservations[${index}].areas`
      )
        ? {
            areas: parseEnumArray(
              row.areas,
              BODY_AREAS,
              `concernObservations[${index}].areas`
            ),
          }
        : {}),
      ...(severity ? { severity: severity as SymptomSeverity } : {}),
      ...(duration ? { duration: duration as SymptomDuration } : {}),
      ...(typeof row.worsening === "boolean"
        ? { worsening: row.worsening }
        : {}),
      ...(parseEnumArray(
        row.redFlags,
        RED_FLAGS,
        `concernObservations[${index}].redFlags`
      )
        ? {
            redFlags: parseEnumArray(
              row.redFlags,
              RED_FLAGS,
              `concernObservations[${index}].redFlags`
            ),
          }
        : {}),
    } satisfies ConcernObservation;
  });
}

function parseIngredientPrefs(row: Record<string, unknown>): {
  allergyIngredients: string[];
  avoidedIngredients: string[];
  currentProducts: ReturnType<typeof normalizeCurrentProducts>;
  rednessObservation?: NonNullable<
    ReturnType<typeof parseRednessObservation>
  >;
  concernObservations?: ConcernObservation[];
} {
  const rednessObservation = parseRednessObservation(
    row.rednessObservation ?? row.redness_observation
  );
  const concernObservations = parseConcernObservations(
    row.concernObservations ?? row.concern_observations
  );

  return {
    allergyIngredients: normalizeIngredientTagList(row.allergyIngredients),
    avoidedIngredients: normalizeIngredientTagList(row.avoidedIngredients),
    currentProducts: normalizeCurrentProducts(
      row.currentProducts ?? row.current_products
    ),
    ...(rednessObservation ? { rednessObservation } : {}),
    ...(concernObservations ? { concernObservations } : {}),
  };
}

function parseRequestBody(body: unknown): AnalyzeSkinRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AnalyzeSkinError(
      "Request body must be a JSON object.",
      400,
      "BAD_REQUEST"
    );
  }

  const row = body as Record<string, unknown>;
  const mode = row.mode;
  const prefs = parseIngredientPrefs(row);

  if (mode === "photo") {
    // Phase 2: 클라이언트 계약 유지. 이미지는 프로바이더로 전달하지 않음.
    if (!isNonEmptyString(row.imageBase64)) {
      throw new AnalyzeSkinError(
        "imageBase64 is required for photo mode.",
        400,
        "BAD_REQUEST"
      );
    }

    const mediaType = row.mediaType;
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ] as const;
    if (
      mediaType !== undefined &&
      (typeof mediaType !== "string" ||
        !(allowed as readonly string[]).includes(mediaType))
    ) {
      throw new AnalyzeSkinError(
        "mediaType must be image/jpeg, image/png, image/webp, or image/gif.",
        400,
        "BAD_REQUEST"
      );
    }

    return {
      mode: "photo",
      imageBase64: row.imageBase64.trim(),
      mediaType: mediaType as
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "image/gif"
        | undefined,
      ...prefs,
    };
  }

  if (mode === "manual") {
    if (!isNonEmptyString(row.skinTone)) {
      throw new AnalyzeSkinError("skinTone is required.", 400, "BAD_REQUEST");
    }
    if (!isNonEmptyString(row.undertone)) {
      throw new AnalyzeSkinError("undertone is required.", 400, "BAD_REQUEST");
    }
    if (!isNonEmptyString(row.sensitivity)) {
      throw new AnalyzeSkinError(
        "sensitivity is required.",
        400,
        "BAD_REQUEST"
      );
    }
    if (!Array.isArray(row.concerns) || row.concerns.length === 0) {
      throw new AnalyzeSkinError(
        "concerns must be a non-empty string array.",
        400,
        "BAD_REQUEST"
      );
    }
    const concerns = row.concerns.filter(
      (c): c is string => typeof c === "string" && c.trim().length > 0
    );
    if (concerns.length === 0) {
      throw new AnalyzeSkinError(
        "concerns must contain at least one string.",
        400,
        "BAD_REQUEST"
      );
    }

    return {
      mode: "manual",
      skinTone: row.skinTone.trim(),
      undertone: row.undertone.trim(),
      concerns,
      sensitivity: row.sensitivity.trim(),
      ...prefs,
    };
  }

  throw new AnalyzeSkinError(
    'mode must be "photo" or "manual".',
    400,
    "BAD_REQUEST"
  );
}

function errorResponse(
  status: number,
  body: AnalyzeSkinErrorBody
): NextResponse<AnalyzeSkinErrorBody> {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse(400, {
      error: "Invalid JSON body.",
      code: "BAD_REQUEST",
    });
  }

  try {
    const input = parseRequestBody(json);
    const result = await analyzeSkin(input);
    // analysis / recommendation / source 계약 유지
    return NextResponse.json({
      analysis: result.analysis,
      recommendation: result.recommendation,
      source: result.source,
    });
  } catch (e) {
    if (e instanceof AnalyzeSkinError) {
      return errorResponse(e.status, { error: e.message, code: e.code });
    }
    return errorResponse(500, {
      error: "Unexpected server error during analysis.",
      code: "PROVIDER",
    });
  }
}

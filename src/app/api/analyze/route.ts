import { NextResponse } from "next/server";
import { AnalyzeSkinError, analyzeSkin } from "@/lib/ai/analyzeSkin";
import { normalizeIngredientTagList } from "@/lib/ai/prompt";
import type {
  AnalyzeSkinErrorBody,
  AnalyzeSkinRequest,
} from "@/lib/ai/types";
import { normalizeCurrentProducts } from "@/lib/recommend/currentProduct";

export const runtime = "nodejs";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseIngredientPrefs(row: Record<string, unknown>): {
  allergyIngredients: string[];
  avoidedIngredients: string[];
  currentProducts: ReturnType<typeof normalizeCurrentProducts>;
} {
  return {
    allergyIngredients: normalizeIngredientTagList(row.allergyIngredients),
    avoidedIngredients: normalizeIngredientTagList(row.avoidedIngredients),
    currentProducts: normalizeCurrentProducts(
      row.currentProducts ?? row.current_products
    ),
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

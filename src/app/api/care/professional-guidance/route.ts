import { NextRequest, NextResponse } from "next/server";
import {
  buildProfessionalGuidanceBundle,
  type ProfessionalGuidanceBundleInput,
} from "@/lib/care/professionalGuidanceBundle";
import type { SymptomArea } from "@/lib/care/professionalRouting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AREAS: SymptomArea[] = [
  "acne",
  "redness_vascular",
  "sensitivity",
  "pigmentation",
  "scarring",
  "allergy",
  "hair_loss_scalp_inflammation",
  "nail_change",
  "oral_smile",
  "sudden_change",
  "prolonged_non_improvement",
];

function parseAreas(raw: unknown): SymptomArea[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is SymptomArea =>
    typeof item === "string" && AREAS.includes(item as SymptomArea),
  );
}

/** Symptom → professional routes + Organic/partner clinic lanes (fixture blocked). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const areas = parseAreas(body.areas);
    if (areas.length === 0 && body.breathingDifficulty !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "AREAS_REQUIRED",
            message: "증상 영역(areas)이 필요합니다.",
          },
        },
        { status: 400 },
      );
    }

    const input: ProfessionalGuidanceBundleInput = {
      areas,
      pain: body.pain === true,
      bleeding: body.bleeding === true,
      discharge: body.discharge === true,
      severeInflammation: body.severeInflammation === true,
      spreadingRash: body.spreadingRash === true,
      breathingDifficulty: body.breathingDifficulty === true,
      suspectedInfection: body.suspectedInfection === true,
      suddenWorsening: body.suddenWorsening === true,
      skinConcerns: Array.isArray(body.skinConcerns)
        ? body.skinConcerns.filter((v): v is string => typeof v === "string")
        : undefined,
      languages: Array.isArray(body.languages)
        ? body.languages.filter((v): v is string => typeof v === "string")
        : ["ko"],
      maxDistanceKm:
        typeof body.maxDistanceKm === "number" ? body.maxDistanceKm : 30,
      includeDemoPreview: body.includeDemoPreview !== false,
    };

    const bundle = buildProfessionalGuidanceBundle(input);
    return NextResponse.json({
      ok: true,
      data: bundle,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PROFESSIONAL_GUIDANCE_UNAVAILABLE",
          message: "전문가 안내를 불러오지 못했습니다.",
        },
      },
      { status: 500 },
    );
  }
}

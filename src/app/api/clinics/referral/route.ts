import { NextRequest, NextResponse } from "next/server";
import type { ProfessionalRoute } from "@/lib/care/professionalRouting";
import { buildClinicReferralPresentation } from "@/lib/clinic/clinicReferralService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRoutes(raw: unknown): ProfessionalRoute[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const professionalType = row.professionalType;
    const urgency = row.urgency;
    const reason = row.reason;
    const productRecommendationAllowed = row.productRecommendationAllowed;
    if (typeof professionalType !== "string" || typeof urgency !== "string") {
      return [];
    }
    if (typeof reason !== "string") return [];
    if (typeof productRecommendationAllowed !== "boolean") return [];
    return [
      {
        professionalType: professionalType as ProfessionalRoute["professionalType"],
        urgency: urgency as ProfessionalRoute["urgency"],
        reason,
        productRecommendationAllowed,
      },
    ];
  });
}

/** Read-only clinic referral presentation. Never invents publishable clinics. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const routes = parseRoutes(body.routes);
    if (routes.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ROUTES_REQUIRED",
            message: "professionalRoutes가 필요합니다.",
          },
        },
        { status: 400 },
      );
    }

    const languages = Array.isArray(body.languages)
      ? body.languages.filter((v): v is string => typeof v === "string")
      : ["ko"];
    const maxDistanceKm =
      typeof body.maxDistanceKm === "number" ? body.maxDistanceKm : 30;
    const consultationBudgetBand =
      body.consultationBudgetBand === "low" ||
      body.consultationBudgetBand === "mid" ||
      body.consultationBudgetBand === "high" ||
      body.consultationBudgetBand === "unknown"
        ? body.consultationBudgetBand
        : null;

    const presentation = buildClinicReferralPresentation({
      routes,
      languages,
      maxDistanceKm,
      consultationBudgetBand,
      includeDemoPreview: body.includeDemoPreview !== false,
    });

    return NextResponse.json({ ok: true, data: presentation });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CLINIC_REFERRAL_UNAVAILABLE",
          message: "병원 안내를 불러오지 못했습니다.",
        },
      },
      { status: 503 },
    );
  }
}

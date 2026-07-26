import { NextRequest, NextResponse } from "next/server";
import {
  submitConsultationLeadDryRun,
  type ConsultationLeadContactMethod,
  type ConsultationLeadInput,
} from "@/lib/clinic/consultationLead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asBool(value: unknown): boolean {
  return value === true;
}

/** Dry-run consultation lead only — no DB / Production write. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const contactMethod = body.contactMethod;
    if (contactMethod !== "email" && contactMethod !== "phone") {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "INVALID_CONTACT_METHOD", message: "연락 방법을 확인해 주세요." },
        },
        { status: 400 },
      );
    }

    const input: ConsultationLeadInput = {
      clinicId: typeof body.clinicId === "string" ? body.clinicId : null,
      professionalType:
        typeof body.professionalType === "string" ? body.professionalType : "",
      contactMethod: contactMethod as ConsultationLeadContactMethod,
      contactValue: typeof body.contactValue === "string" ? body.contactValue : "",
      preferredLanguage:
        typeof body.preferredLanguage === "string" ? body.preferredLanguage : "ko",
      consentPersonalInfo: asBool(body.consentPersonalInfo),
      consentShareWithClinic: asBool(body.consentShareWithClinic),
      consentNotDiagnosis: asBool(body.consentNotDiagnosis),
      notes: typeof body.notes === "string" ? body.notes : null,
    };

    const record = submitConsultationLeadDryRun(input);
    if (record.status === "rejected") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "LEAD_VALIDATION_FAILED",
            message: "동의·연락처를 확인해 주세요.",
            reasons: record.rejectReasons,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: record.id,
        status: record.status,
        deliveryMode: record.deliveryMode,
        createdAt: record.createdAt,
        databaseTouched: false,
        productionTouched: false,
        message:
          "상담 요청이 dry-run으로만 기록되었습니다. 실제 병원 전달·DB 저장은 없습니다.",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "LEAD_UNAVAILABLE",
          message: "상담 요청을 처리하지 못했습니다.",
        },
      },
      { status: 503 },
    );
  }
}

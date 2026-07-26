import { NextRequest, NextResponse } from "next/server";
import {
  recordCommerceEvent,
  type CommerceEventInput,
  type CommerceEventType,
  type CommerceLane,
} from "@/lib/commercial/commerceAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES: CommerceEventType[] = [
  "click",
  "lead",
  "conversion",
  "revenue",
];
const LANES: CommerceLane[] = [
  "organic",
  "affiliate",
  "sponsored",
  "partner_clinic",
];

/**
 * Record commerce analytics without health/ad targeting payloads.
 * In-memory only — no Production DB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type;
    const lane = body.lane;
    if (
      typeof type !== "string" ||
      !EVENT_TYPES.includes(type as CommerceEventType)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "EVENT_TYPE_INVALID", message: "이벤트 유형이 올바르지 않습니다." },
        },
        { status: 400 },
      );
    }
    if (typeof lane !== "string" || !LANES.includes(lane as CommerceLane)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "LANE_INVALID", message: "상업 레인이 올바르지 않습니다." },
        },
        { status: 400 },
      );
    }

    const input: CommerceEventInput = {
      type: type as CommerceEventType,
      lane: lane as CommerceLane,
      entityType:
        body.entityType === "clinic" || body.entityType === "media"
          ? body.entityType
          : "product",
      entityId: typeof body.entityId === "string" ? body.entityId : "",
      campaignId: typeof body.campaignId === "string" ? body.campaignId : null,
      partner: typeof body.partner === "string" ? body.partner : null,
      revenueAmount:
        typeof body.revenueAmount === "number" ? body.revenueAmount : null,
      currency: typeof body.currency === "string" ? body.currency : null,
      targetingProfile:
        body.targetingProfile && typeof body.targetingProfile === "object"
          ? (body.targetingProfile as Record<string, unknown>)
          : null,
    };

    const result = recordCommerceEvent(input);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "EVENT_REJECTED",
            message: "이벤트가 거부되었습니다.",
            reasons: result.reasons,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: result.event,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "COMMERCE_EVENT_UNAVAILABLE",
          message: "상업 이벤트를 기록하지 못했습니다.",
        },
      },
      { status: 500 },
    );
  }
}

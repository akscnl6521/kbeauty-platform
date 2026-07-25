import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  scrubEventForAnalytics,
  validateClickConversionEvent,
  type ClickConversionEventInput,
  type ClickConversionEventKind,
  type RevenueLane,
} from "@/lib/commercial/revenueReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_KINDS: ClickConversionEventKind[] = [
  "impression",
  "click",
  "lead",
  "conversion",
];
const LANES: RevenueLane[] = ["affiliate", "sponsored"];
const ENTITY_TYPES = ["product", "clinic", "media"] as const;

/**
 * Real click/conversion event ingestion for the monetization pipeline
 * (ROADMAP stage 7). Client components cannot use the service-role key
 * directly, so this route does the validated write on their behalf.
 *
 * No real commercial agreements are activated here and no revenue amount
 * is invented — this only persists what the caller explicitly supplies,
 * after the same validate/scrub pass used everywhere else in the
 * revenueReadiness module (health/symptom targeting is rejected).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BODY_INVALID", message: "요청 본문이 올바르지 않습니다." } },
      { status: 400 },
    );
  }

  const kind = body.kind;
  const lane = body.lane;
  const entityType = body.entityType;

  if (typeof kind !== "string" || !EVENT_KINDS.includes(kind as ClickConversionEventKind)) {
    return NextResponse.json(
      { ok: false, error: { code: "KIND_INVALID", message: "이벤트 종류가 올바르지 않습니다." } },
      { status: 400 },
    );
  }
  if (typeof lane !== "string" || !LANES.includes(lane as RevenueLane)) {
    return NextResponse.json(
      { ok: false, error: { code: "LANE_INVALID", message: "레인이 올바르지 않습니다." } },
      { status: 400 },
    );
  }
  if (
    typeof entityType !== "string" ||
    !ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])
  ) {
    return NextResponse.json(
      { ok: false, error: { code: "ENTITY_TYPE_INVALID", message: "엔티티 유형이 올바르지 않습니다." } },
      { status: 400 },
    );
  }

  const input: ClickConversionEventInput = {
    eventId:
      typeof body.eventId === "string" && body.eventId.trim()
        ? body.eventId
        : crypto.randomUUID(),
    kind: kind as ClickConversionEventKind,
    lane: lane as RevenueLane,
    entityType: entityType as (typeof ENTITY_TYPES)[number],
    entityId: typeof body.entityId === "string" ? body.entityId : "",
    offerOrPlacementId:
      typeof body.offerOrPlacementId === "string" ? body.offerOrPlacementId : "",
    countryCode: typeof body.countryCode === "string" ? body.countryCode : null,
    targetingProfile:
      body.targetingProfile && typeof body.targetingProfile === "object"
        ? (body.targetingProfile as Record<string, unknown>)
        : null,
    revenueAmount:
      typeof body.revenueAmount === "number" ? body.revenueAmount : null,
    currency: typeof body.currency === "string" ? body.currency : null,
  };

  const validation = validateClickConversionEvent(input);
  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "EVENT_REJECTED",
          message: "이벤트가 거부되었습니다.",
          reasons: validation.reasons,
        },
      },
      { status: 400 },
    );
  }

  const scrubbed = scrubEventForAnalytics(input);
  if (!scrubbed) {
    return NextResponse.json(
      { ok: false, error: { code: "EVENT_SCRUB_FAILED", message: "이벤트를 저장할 수 없습니다." } },
      { status: 400 },
    );
  }

  const sessionRef =
    typeof body.sessionRef === "string" && body.sessionRef.trim()
      ? body.sessionRef.slice(0, 200)
      : null;
  const screen = typeof body.screen === "string" ? body.screen.slice(0, 200) : null;

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("commercial_click_events").insert({
      event_id: scrubbed.eventId,
      kind: scrubbed.kind,
      lane: scrubbed.lane,
      entity_type: scrubbed.entityType,
      entity_id: scrubbed.entityId,
      offer_or_placement_id: scrubbed.offerOrPlacementId,
      country_code: scrubbed.countryCode ?? null,
      revenue_amount: scrubbed.revenueAmount ?? null,
      currency: scrubbed.currency ?? null,
      session_ref: sessionRef,
      screen,
    });

    if (error) {
      // Duplicate eventId (retry / double-fire) is not a failure.
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, data: { deduped: true } });
      }
      return NextResponse.json(
        {
          ok: false,
          error: { code: "EVENT_WRITE_FAILED", message: error.message },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data: { eventId: scrubbed.eventId } });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "EVENT_PIPELINE_UNAVAILABLE",
          message: err instanceof Error ? err.message : "unknown error",
        },
      },
      { status: 500 },
    );
  }
}

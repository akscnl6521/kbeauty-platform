import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  applyAdminOpsTransition,
  applyDuplicateMerge,
  buildAdminOpsSummary,
  getStaleRefreshQueue,
  listAdminOpsAuditTrail,
  listAdminOpsCandidates,
  reviewEvidence,
  seedAdminOpsFixtures,
  type AdminOpsTransition,
} from "@/lib/catalog/adminOps";

export const dynamic = "force-dynamic";

const TRANSITIONS = new Set<AdminOpsTransition>([
  "start_review",
  "request_evidence",
  "approve_staging",
  "reject",
  "mark_duplicate",
  "mark_stale",
  "queue_retry",
  "clear_retry",
]);

/**
 * Admin catalog ops visibility + local/Staging dry-run actions.
 * In-memory only · no Production / Staging DB write.
 */
export async function GET() {
  await requireAdminUser();
  if (listAdminOpsCandidates().length === 0) {
    seedAdminOpsFixtures();
  }
  return NextResponse.json({
    ok: true,
    data: {
      summary: buildAdminOpsSummary(),
      candidates: listAdminOpsCandidates().slice(0, 50),
      staleQueue: getStaleRefreshQueue().slice(0, 50),
      audit: listAdminOpsAuditTrail(40),
      productionTouched: false,
      databaseTouched: false,
      stagingWritePerformed: false,
    },
  });
}

export async function POST(request: Request) {
  await requireAdminUser();
  if (listAdminOpsCandidates().length === 0) {
    seedAdminOpsFixtures();
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const mode =
    body.mode === "staging_dry_run" ? "staging_dry_run" : "local";

  if (action === "seed") {
    const seeded = seedAdminOpsFixtures();
    return NextResponse.json({
      ok: true,
      data: { seeded: seeded.length, summary: buildAdminOpsSummary() },
    });
  }

  if (action === "transition") {
    const candidateId = typeof body.candidateId === "string" ? body.candidateId : "";
    const transition = body.transition;
    if (!candidateId || typeof transition !== "string" || !TRANSITIONS.has(transition as AdminOpsTransition)) {
      return NextResponse.json({ ok: false, error: "invalid_transition" }, { status: 400 });
    }
    const result = applyAdminOpsTransition(candidateId, transition as AdminOpsTransition, {
      mode,
    });
    return NextResponse.json({ ok: result.ok, data: result });
  }

  if (action === "review_evidence") {
    const candidateId = typeof body.candidateId === "string" ? body.candidateId : "";
    const evidenceId = typeof body.evidenceId === "string" ? body.evidenceId : "";
    const verified = body.verified === true;
    if (!candidateId || !evidenceId) {
      return NextResponse.json({ ok: false, error: "invalid_evidence" }, { status: 400 });
    }
    const result = reviewEvidence(candidateId, evidenceId, verified);
    return NextResponse.json({ ok: result.ok, data: result });
  }

  if (action === "duplicate_merge") {
    const keepId = typeof body.keepId === "string" ? body.keepId : "";
    const mergeIds = Array.isArray(body.mergeIds)
      ? body.mergeIds.filter((id): id is string => typeof id === "string")
      : [];
    if (!keepId || mergeIds.length === 0) {
      return NextResponse.json({ ok: false, error: "invalid_merge" }, { status: 400 });
    }
    const result = applyDuplicateMerge(keepId, mergeIds);
    return NextResponse.json({ ok: result.ok, data: result });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}

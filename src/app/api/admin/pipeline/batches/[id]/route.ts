import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getPipelinePersistence } from "@/lib/pipeline/persistence";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * GET /api/admin/pipeline/batches/[id]
 */
export const GET = withAdminAuth(async (_req: NextRequest, context: RouteContext) => {
  try {
    const params = (await context.params) ?? {};
    const raw = params.id;
    const batchId = Array.isArray(raw) ? raw[0] : raw;
    if (!batchId) return jsonFail(400, "INVALID_INPUT", "batchId 필요");

    const persistence = getPipelinePersistence({ requireSupabase: true });
    const batch = await persistence.getBatch(batchId);
    if (!batch) return jsonFail(404, "NOT_FOUND", "배치를 찾을 수 없습니다.");

    const jobs = await persistence.listJobs(batchId);
    const safeJobs = jobs.map((j) => ({
      jobId: j.jobId,
      entityType: j.entityType,
      entityLabel: j.entityLabel,
      brandName: j.brandName,
      stage: j.stage,
      status: j.status,
      attempts: j.attempts,
      failureCode: j.failureCode,
      safeFailureMessage: j.safeFailureMessage,
      warnings: j.warnings,
      resultSummary: j.resultSummary,
      nextRetryAt: j.nextRetryAt,
      completedAt: j.completedAt,
      claimHeartbeatAt: j.claimHeartbeatAt,
    }));

    return jsonOk({
      backend: persistence.backend,
      batch: {
        batchId: batch.batchId,
        mode: batch.mode,
        status: batch.status,
        triggerType: batch.triggerType,
        progress: batch.progress,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        startedAt: batch.startedAt,
        pausedAt: batch.pausedAt,
        completedAt: batch.completedAt,
        lockOwner: batch.lockOwner ? "held" : null,
        lockHeartbeatAt: batch.lockHeartbeatAt,
        safeErrorCode: batch.safeErrorCode,
        safeErrorMessage: batch.safeErrorMessage,
        notes: batch.notes,
      },
      jobs: safeJobs,
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

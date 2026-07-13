import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { listJobs, loadBatch } from "@/lib/pipeline/checkpoint";
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

    const batch = await loadBatch(batchId);
    if (!batch) return jsonFail(404, "NOT_FOUND", "배치를 찾을 수 없습니다.");

    const jobs = await listJobs(batchId);
    const safeJobs = jobs.map((j) => ({
      jobId: j.jobId,
      entityType: j.entityType,
      entityLabel: j.entityLabel,
      stage: j.stage,
      status: j.status,
      attempts: j.attempts,
      failureCode: j.failureCode,
      safeFailureMessage: j.safeFailureMessage,
      warnings: j.warnings,
      resultSummary: j.resultSummary,
      completedAt: j.completedAt,
    }));

    return jsonOk({
      batch,
      jobs: safeJobs,
      reviewJobs: safeJobs.filter((j) => j.status === "needs_review"),
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

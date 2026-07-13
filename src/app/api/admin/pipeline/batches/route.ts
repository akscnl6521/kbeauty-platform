import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { assertAdminPermission } from "@/lib/auth/admin-permissions";
import {
  createPipelineBatch,
  retryFailedJobs,
  setPipelineBatchStatus,
  tickPipelineBatch,
} from "@/lib/pipeline/orchestrator";
import { listBatches } from "@/lib/pipeline/checkpoint";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/pipeline/batches
 */
export const GET = withAdminAuth(async () => {
  try {
    const batches = await listBatches();
    return jsonOk({ items: batches });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

/**
 * POST /api/admin/pipeline/batches
 * body: { action, batchId?, mode?, brandLimit?, productLimitPerBrand?, tickLimit? }
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    assertAdminPermission(session, "pipeline.run");
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
    }

    const action = String(body.action ?? "");

    if (action === "start") {
      const batch = await createPipelineBatch({
        mode: body.mode === "commit" ? "commit" : "dry_run",
        brandLimit: Number(body.brandLimit ?? 10),
        productLimitPerBrand: Number(body.productLimitPerBrand ?? 20),
      });
      // auto first tick
      const tick = await tickPipelineBatch(batch.batchId, {
        limit: Number(body.tickLimit ?? 3),
      });
      return jsonOk({ batch: tick.batch, processed: tick.processed }, 201);
    }

    if (action === "tick") {
      const batchId = String(body.batchId ?? "");
      if (!batchId) return jsonFail(400, "INVALID_INPUT", "batchId 필요");
      const tick = await tickPipelineBatch(batchId, {
        limit: Number(body.tickLimit ?? 5),
      });
      return jsonOk(tick);
    }

    if (action === "pause" || action === "cancel" || action === "resume") {
      assertAdminPermission(session, "pipeline.manage");
      const batchId = String(body.batchId ?? "");
      if (!batchId) return jsonFail(400, "INVALID_INPUT", "batchId 필요");
      const status =
        action === "pause"
          ? "paused"
          : action === "cancel"
            ? "cancelled"
            : "queued";
      const batch = await setPipelineBatchStatus(batchId, status);
      if (!batch) return jsonFail(404, "NOT_FOUND", "배치를 찾을 수 없습니다.");
      return jsonOk({ batch });
    }

    if (action === "retry") {
      assertAdminPermission(session, "pipeline.manage");
      const batchId = String(body.batchId ?? "");
      if (!batchId) return jsonFail(400, "INVALID_INPUT", "batchId 필요");
      const count = await retryFailedJobs(batchId);
      return jsonOk({ retried: count });
    }

    return jsonFail(400, "INVALID_INPUT", "알 수 없는 action");
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

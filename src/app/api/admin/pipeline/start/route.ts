import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { assertAdminPermission } from "@/lib/auth/admin-permissions";
import {
  createPipelineBatch,
  tickPipelineBatch,
} from "@/lib/pipeline/orchestrator";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/pipeline/start
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    assertAdminPermission(session, "pipeline.run");
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const batch = await createPipelineBatch({
      mode: body.mode === "commit" ? "commit" : "dry_run",
      brandLimit: Number(body.brandLimit ?? 10),
      productLimitPerBrand: Number(body.productLimitPerBrand ?? 20),
    });
    const tick = await tickPipelineBatch(batch.batchId, {
      limit: Number(body.tickLimit ?? 3),
    });
    return jsonOk({ batch: tick.batch, processed: tick.processed }, 201);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

export const GET = withAdminAuth(async () => {
  return jsonFail(405, "METHOD_NOT_ALLOWED", "POST만 지원합니다.");
}, ADMIN_ROLES);

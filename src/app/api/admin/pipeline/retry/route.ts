import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { assertAdminPermission } from "@/lib/auth/admin-permissions";
import { retryFailedJobs } from "@/lib/pipeline/orchestrator";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    assertAdminPermission(session, "pipeline.manage");
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
    }
    const batchId = String(body.batchId ?? "");
    if (!batchId) return jsonFail(400, "INVALID_INPUT", "batchId 필요");
    const retried = await retryFailedJobs(batchId);
    return jsonOk({ retried });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

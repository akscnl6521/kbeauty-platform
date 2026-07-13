import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { commitDiscoveryImport } from "@/lib/admin/import/commit";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/discovery/import/commit
 * Bulk create candidates after server re-validation.
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
    }

    const payload = (body ?? {}) as Record<string, unknown>;
    const result = await commitDiscoveryImport(session, {
      items: payload.items,
      createDuplicateQueue: payload.createDuplicateQueue,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

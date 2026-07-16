import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations/health";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/operations/health
 */
export const GET = withAdminAuth(async () => {
  try {
    const snapshot = await getOperationsHealthSnapshot({ persistAlerts: true });
    return jsonOk(snapshot);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

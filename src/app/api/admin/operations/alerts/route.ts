import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations/health";
import { listAlertRules } from "@/lib/admin/operations/rules";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/operations/alerts
 */
export const GET = withAdminAuth(async () => {
  try {
    const snapshot = await getOperationsHealthSnapshot({ persistAlerts: true });
    return jsonOk({
      grade: snapshot.grade,
      checkedAt: snapshot.checkedAt,
      alerts: snapshot.alerts,
      rules: listAlertRules(),
      openCritical: snapshot.openCritical,
      openWarning: snapshot.openWarning,
      openInfo: snapshot.openInfo,
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

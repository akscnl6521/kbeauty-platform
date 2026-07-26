import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getCheckinEmailQueueStatusCounts } from "@/lib/admin/checkinEmailQueueStatus";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only: queue status counts (no payloads / PII). */
export const GET = withAdminAuth(async () => {
  try {
    const data = await getCheckinEmailQueueStatusCounts();
    return jsonOk(data);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

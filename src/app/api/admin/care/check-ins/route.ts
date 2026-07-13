import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getAdminCareCheckInsByDay } from "@/lib/admin/care-ops";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async () => {
  try {
    const data = await getAdminCareCheckInsByDay();
    return jsonOk(data);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

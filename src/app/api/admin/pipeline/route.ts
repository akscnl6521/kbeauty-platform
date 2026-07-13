import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getPipelinePersistence } from "@/lib/pipeline/persistence";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pipeline — recent batches summary (Supabase)
 */
export const GET = withAdminAuth(async () => {
  try {
    const persistence = getPipelinePersistence({ requireSupabase: true });
    const batches = await persistence.listBatches(30);
    return jsonOk({
      backend: persistence.backend,
      batches: batches.map((b) => ({
        batchId: b.batchId,
        mode: b.mode,
        status: b.status,
        triggerType: b.triggerType,
        progress: b.progress,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        startedAt: b.startedAt,
        completedAt: b.completedAt,
        lockOwner: b.lockOwner ? "held" : null,
        lockHeartbeatAt: b.lockHeartbeatAt,
        safeErrorCode: b.safeErrorCode,
        notes: b.notes,
      })),
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

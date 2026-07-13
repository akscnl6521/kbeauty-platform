import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { listBatches } from "@/lib/pipeline/checkpoint";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pipeline — recent batches summary
 */
export const GET = withAdminAuth(async () => {
  try {
    const batches = await listBatches();
    return jsonOk({
      batches: batches.slice(0, 50).map((b) => ({
        batchId: b.batchId,
        mode: b.mode,
        status: b.status,
        progress: b.progress,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        notes: b.notes,
      })),
      persistence: "file",
      note: "Phase 1 uses file checkpoints under data/pipeline/runtime",
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

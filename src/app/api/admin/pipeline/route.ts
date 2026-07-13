import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPipelinePersistence } from "@/lib/pipeline/persistence";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pipeline — recent batches + autonomous ops summary
 */
export const GET = withAdminAuth(async () => {
  try {
    const persistence = getPipelinePersistence({ requireSupabase: true });
    const batches = await persistence.listBatches(30);
    const client = createSupabaseAdminClient();

    const [
      brandSites,
      verifiedSites,
      reviewSites,
      blockedSites,
      candidatesPipeline,
      queuePending,
    ] = await Promise.all([
      client.from("brand_official_site_state").select("id", { count: "exact", head: true }),
      client
        .from("brand_official_site_state")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "verified"),
      client
        .from("brand_official_site_state")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "needs_review"),
      client
        .from("brand_official_site_state")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "blocked"),
      client
        .from("product_discovery_candidates")
        .select("id", { count: "exact", head: true })
        .ilike("notes", "%autonomous_pipeline%"),
      client
        .from("verification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("review_type", "duplicate"),
    ]);

    const dryRuns = batches.filter((b) => b.mode === "dry_run").length;
    const commits = batches.filter((b) => b.mode === "commit").length;
    const reviewJobs = batches.reduce((n, b) => n + b.progress.reviewItems, 0);
    const failedJobs = batches.reduce((n, b) => n + b.progress.failedItems, 0);
    const latest = batches[0] ?? null;

    return jsonOk({
      backend: persistence.backend,
      ops: {
        dryRunBatches: dryRuns,
        commitBatches: commits,
        reviewItemsRecent: reviewJobs,
        failedItemsRecent: failedJobs,
        brandSites: brandSites.count ?? 0,
        verifiedOfficialBrands: verifiedSites.count ?? 0,
        needsReviewBrands: reviewSites.count ?? 0,
        blockedBrands: blockedSites.count ?? 0,
        autonomousCandidates: candidatesPipeline.count ?? 0,
        pendingDuplicateQueues: queuePending.count ?? 0,
        latestBatchId: latest?.batchId ?? null,
        latestStatus: latest?.status ?? null,
        latestHeartbeat: latest?.lockHeartbeatAt ?? null,
        schedulerHint: "KBeautyMatch-Pipeline (local Task Scheduler)",
      },
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

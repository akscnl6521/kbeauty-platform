import { NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  loadPipelineOperationConfig,
  savePipelineOperationOverrides,
  type PipelineOperationAdminPatch,
} from "@/lib/pipeline/operation-config";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/PATCH pipeline operation settings (file overrides).
 * Hard locks (publish/delete/products/offers) cannot be enabled.
 */
export const GET = withAdminAuth(async () => {
  try {
    const config = loadPipelineOperationConfig();
    return jsonOk({
      config,
      immutable: {
        allowProductInsert: false,
        allowOfferInsert: false,
        allowPublish: false,
        allowDelete: false,
        allowIngredientWrite: false,
        allowExistingCandidateBulkUpdate: false,
      },
      schedulerFixedCommand: "node scripts/run-pipeline-worker.mjs",
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

export const PATCH = withAdminAuth(async (req: NextRequest, _ctx, session) => {
  try {
    const body = (await req.json()) as PipelineOperationAdminPatch;
    const patch: PipelineOperationAdminPatch = {};
    if (body.mode === "dry_run" || body.mode === "gated_commit") {
      patch.mode = body.mode;
    }
    if (typeof body.paused === "boolean") patch.paused = body.paused;
    if (typeof body.brandsPerRun === "number") {
      patch.brandsPerRun = body.brandsPerRun;
    }
    if (typeof body.productsPerBrand === "number") {
      patch.productsPerBrand = body.productsPerBrand;
    }
    if (typeof body.allowCandidateInsert === "boolean") {
      patch.allowCandidateInsert = body.allowCandidateInsert;
    }
    if (typeof body.allowQueueInsert === "boolean") {
      patch.allowQueueInsert = body.allowQueueInsert;
    }
    if (typeof body.allowAuditInsert === "boolean") {
      patch.allowAuditInsert = body.allowAuditInsert;
    }
    if (typeof body.scheduleHint === "string") {
      patch.scheduleHint = body.scheduleHint.slice(0, 80);
    }

    const config = savePipelineOperationOverrides(patch);
    const client = createSupabaseAdminClient();
    await tryInsertWriteAudit(client, {
      action: "pipeline_operation_settings_updated",
      productId: null,
      actorRole: session.role,
      metadata: {
        patch,
        mode: config.mode,
        paused: config.paused,
      },
    });

    return jsonOk({ config });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

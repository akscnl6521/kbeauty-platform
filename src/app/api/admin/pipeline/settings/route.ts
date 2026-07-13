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
        allowVerifiedOfferInsert: false,
        allowPublish: false,
        allowDelete: false,
        allowIngredientWrite: false,
        allowExistingCandidateBulkUpdate: false,
        allowExistingProductOverwrite: false,
        allowProductDemotion: false,
        allowUnverifiedPurchaseRecommendation: false,
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
    if (typeof body.allowDraftProductInsert === "boolean") {
      patch.allowDraftProductInsert = body.allowDraftProductInsert;
    }
    if (typeof body.allowVariantInsert === "boolean") {
      patch.allowVariantInsert = body.allowVariantInsert;
    }
    if (typeof body.allowProductIngredientInsert === "boolean") {
      patch.allowProductIngredientInsert = body.allowProductIngredientInsert;
    }
    if (typeof body.allowSkinScoreUpsert === "boolean") {
      patch.allowSkinScoreUpsert = body.allowSkinScoreUpsert;
    }
    if (typeof body.allowQualityScoreUpsert === "boolean") {
      patch.allowQualityScoreUpsert = body.allowQualityScoreUpsert;
    }
    if (typeof body.allowCandidateAutoChecks === "boolean") {
      patch.allowCandidateAutoChecks = body.allowCandidateAutoChecks;
    }
    if (typeof body.allowOfferCandidateInsert === "boolean") {
      patch.allowOfferCandidateInsert = body.allowOfferCandidateInsert;
    }
    if (typeof body.allowVerifiedOfferUpsert === "boolean") {
      patch.allowVerifiedOfferUpsert = body.allowVerifiedOfferUpsert;
    }
    if (typeof body.allowOfferFreshnessUpdate === "boolean") {
      patch.allowOfferFreshnessUpdate = body.allowOfferFreshnessUpdate;
    }
    if (typeof body.allowOfferReviewQueue === "boolean") {
      patch.allowOfferReviewQueue = body.allowOfferReviewQueue;
    }
    if (typeof body.allowProductAutoVerify === "boolean") {
      patch.allowProductAutoVerify = body.allowProductAutoVerify;
    }
    if (typeof body.allowProductAutoActivate === "boolean") {
      patch.allowProductAutoActivate = body.allowProductAutoActivate;
    }
    if (typeof body.allowProductReevaluation === "boolean") {
      patch.allowProductReevaluation = body.allowProductReevaluation;
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

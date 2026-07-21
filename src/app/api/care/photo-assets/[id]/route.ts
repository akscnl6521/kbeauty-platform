import {
  careJsonFail,
  careJsonFromError,
  careJsonOk,
} from "@/lib/care/api-response";
import { getCareAuthUser } from "@/lib/care/auth";
import {
  isPhotoMigrationMissing,
  isProductionAppEnv,
  isSyntheticFixtureRequest,
} from "@/lib/care/photoComparisonApiHelpers";
import {
  applyIdempotentDeleteStatus,
  evaluatePhotoDeleteAccess,
  type PhotoStorageStatus,
} from "@/lib/care/photoComparisonPolicy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type AssetRow = {
  id: string;
  user_id: string;
  storage_status: string;
};

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const { id } = await params;
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("photo_assets")
      .select("id, user_id, storage_status")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (isPhotoMigrationMissing(error)) {
        return careJsonFail(
          503,
          "MIGRATION_PENDING",
          "사진 비교 기능 DB migration이 아직 적용되지 않았습니다."
        );
      }
      throw error;
    }

    if (!data) {
      return careJsonFail(404, "NOT_FOUND", "사진을 찾을 수 없습니다.");
    }

    const asset = data as AssetRow;
    if (
      evaluatePhotoDeleteAccess({
        assetUserId: asset.user_id,
        requesterUserId: auth.userId,
      }) === "deny"
    ) {
      return careJsonFail(403, "FORBIDDEN", "삭제 권한이 없습니다.");
    }

    const idempotent = applyIdempotentDeleteStatus(
      asset.storage_status as PhotoStorageStatus
    );
    if (idempotent.idempotent) {
      return careJsonOk({ assetId: id, status: "deleted", idempotent: true });
    }

    const now = new Date().toISOString();
    const syntheticOnly =
      !isProductionAppEnv() && isSyntheticFixtureRequest(request);

    if (isProductionAppEnv()) {
      const { error: queueError } = await client
        .from("photo_deletion_requests")
        .insert({
          user_id: auth.userId,
          asset_id: asset.id,
          status: "pending",
          idempotency_key: `photo-delete:${auth.userId}:${asset.id}`,
          retry_count: 0,
          created_at: now,
        });

      if (queueError && !isPhotoMigrationMissing(queueError)) {
        throw queueError;
      }

      await client
        .from("photo_assets")
        .update({ storage_status: "pending_delete" })
        .eq("id", asset.id)
        .eq("user_id", auth.userId);

      return careJsonOk({
        assetId: id,
        status: "pending_delete",
        storageDeleteSkipped: true,
      });
    }

    if (syntheticOnly) {
      const { error: updateError } = await client
        .from("photo_assets")
        .update({
          storage_status: "deleted",
          deleted_at: now,
        })
        .eq("id", asset.id)
        .eq("user_id", auth.userId);

      if (updateError) {
        if (isPhotoMigrationMissing(updateError)) {
          return careJsonFail(
            503,
            "MIGRATION_PENDING",
            "사진 비교 기능 DB migration이 아직 적용되지 않았습니다."
          );
        }
        throw updateError;
      }
    } else {
      await client
        .from("photo_assets")
        .update({ storage_status: "pending_delete" })
        .eq("id", asset.id)
        .eq("user_id", auth.userId);
    }

    return careJsonOk({
      assetId: id,
      status: syntheticOnly ? "deleted" : "pending_delete",
      storageDeleteSkipped: true,
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}

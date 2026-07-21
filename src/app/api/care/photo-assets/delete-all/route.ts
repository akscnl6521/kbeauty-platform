import {
  careJsonFail,
  careJsonFromError,
  careJsonOk,
} from "@/lib/care/api-response";
import { getCareAuthUser } from "@/lib/care/auth";
import { isPhotoMigrationMissing } from "@/lib/care/photoComparisonApiHelpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("photo_assets")
      .select("id, storage_status")
      .eq("user_id", auth.userId)
      .neq("storage_status", "deleted");

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

    const now = new Date().toISOString();
    let deletedCount = 0;
    for (const row of data ?? []) {
      const asset = row as { id: string; storage_status: string };
      if (asset.storage_status === "deleted") continue;

      await client
        .from("photo_deletion_requests")
        .upsert(
          {
            user_id: auth.userId,
            asset_id: asset.id,
            status: "pending",
            idempotency_key: `photo-delete:${auth.userId}:${asset.id}`,
            retry_count: 0,
            created_at: now,
          },
          { onConflict: "idempotency_key", ignoreDuplicates: true }
        );

      await client
        .from("photo_assets")
        .update({
          storage_status: "pending_delete",
          deleted_at: now,
        })
        .eq("id", asset.id)
        .eq("user_id", auth.userId);

      deletedCount += 1;
    }

    return careJsonOk({
      deletedCount,
      storageDeleteSkipped: true,
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}

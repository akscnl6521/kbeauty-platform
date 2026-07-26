import { randomUUID } from "crypto";
import {
  careJsonFail,
  careJsonFromError,
  careJsonOk,
} from "@/lib/care/api-response";
import { ensureCareProfile, getCareAuthUser } from "@/lib/care/auth";
import {
  isPhotoMigrationMissing,
  isProductionAppEnv,
  isSyntheticFixtureRequest,
} from "@/lib/care/photoComparisonApiHelpers";
import {
  DEFAULT_RETENTION_DAYS,
  buildCarePhotoObjectPath,
  canPersistPhoto,
  defaultPhotoConsentChoices,
  type PhotoConsentChoices,
} from "@/lib/care/photoComparisonPolicy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssetRow = {
  id: string;
  user_id: string;
  analysis_session_id: string | null;
  storage_status: string;
  object_path_original: string;
  object_path_thumb: string;
  object_path_preview: string;
  retention_days: number;
  expires_at: string | null;
  consent_id: string | null;
  learning_opt_in: boolean;
  content_type: string;
  byte_size: number;
  created_at: string;
  deleted_at: string | null;
};

function mapAsset(row: AssetRow) {
  return {
    id: row.id,
    storageStatus: row.storage_status,
    retentionDays: row.retention_days,
    expiresAt: row.expires_at,
    learningOptIn: row.learning_opt_in,
    contentType: row.content_type,
    byteSize: row.byte_size,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export async function GET() {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("photo_assets")
      .select(
        "id, user_id, analysis_session_id, storage_status, object_path_original, object_path_thumb, object_path_preview, retention_days, expires_at, consent_id, learning_opt_in, content_type, byte_size, created_at, deleted_at"
      )
      .eq("user_id", auth.userId)
      .neq("storage_status", "deleted")
      .order("created_at", { ascending: false });

    if (error) {
      if (isPhotoMigrationMissing(error)) {
        return careJsonOk({ assets: [], migrationPending: true });
      }
      throw error;
    }

    return careJsonOk({
      assets: ((data ?? []) as AssetRow[]).map(mapAsset),
      migrationPending: false,
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}

type SyntheticBody = {
  choices?: Partial<PhotoConsentChoices>;
  contentType?: string;
  byteSize?: number;
  analysisSessionId?: string | null;
  consentId?: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    if (isProductionAppEnv() || !isSyntheticFixtureRequest(request)) {
      return careJsonFail(
        501,
        "NOT_IMPLEMENTED",
        "실제 사진 업로드는 Staging Storage 승인 후 제공됩니다."
      );
    }

    const body = (await request.json()) as SyntheticBody;
    const choices = { ...defaultPhotoConsentChoices(), ...body.choices };
    if (!canPersistPhoto(choices)) {
      return careJsonFail(
        400,
        "SAVE_CONSENT_REQUIRED",
        "비교용 저장 동의가 필요합니다."
      );
    }

    await ensureCareProfile(auth.userId);
    const client = await createSupabaseServerClient();
    const assetId = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + DEFAULT_RETENTION_DAYS * 86_400_000
    ).toISOString();

    const insertRow = {
      id: assetId,
      user_id: auth.userId,
      analysis_session_id: body.analysisSessionId ?? null,
      storage_status: "stored",
      object_path_original: buildCarePhotoObjectPath({
        userId: auth.userId,
        assetId,
        derivative: "original",
      }),
      object_path_thumb: buildCarePhotoObjectPath({
        userId: auth.userId,
        assetId,
        derivative: "thumb",
      }),
      object_path_preview: buildCarePhotoObjectPath({
        userId: auth.userId,
        assetId,
        derivative: "preview",
      }),
      retention_days: DEFAULT_RETENTION_DAYS,
      expires_at: expiresAt,
      consent_id: body.consentId ?? null,
      learning_opt_in: choices.learningOptIn,
      content_type: body.contentType ?? "image/jpeg",
      byte_size: body.byteSize ?? 1024,
      created_at: now,
      deleted_at: null,
    };

    const { data, error } = await client
      .from("photo_assets")
      .insert(insertRow)
      .select("*")
      .single();

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

    return careJsonOk({
      asset: mapAsset(data as AssetRow),
      synthetic: true,
      migrationPending: false,
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}

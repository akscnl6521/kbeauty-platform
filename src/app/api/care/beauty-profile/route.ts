import {
  careJsonFail,
  careJsonFromError,
  careJsonOk,
} from "@/lib/care/api-response";
import { ensureCareProfile, getCareAuthUser } from "@/lib/care/auth";
import {
  parseBeautyProfile,
  sanitizeConfirmedProfilePatch,
  type ConfirmedProfilePatch,
} from "@/lib/profile/beautyProfile";
import {
  applyConfirmedPatchForUser,
  readBeautyProfileForUser,
} from "@/lib/profile/beautyProfileServer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET durable BeautyProfile for the signed-in user.
 * When the DRAFT migration is not applied, returns migrationPending and null profile
 * so the client keeps using the local care store fallback.
 */
export async function GET() {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const client = await createSupabaseServerClient();
    const result = await readBeautyProfileForUser(client, auth.userId);
    if (!result.ok) throw result.error;

    return careJsonOk({
      profile: result.profile,
      migrationPending: result.migrationPending,
      updatedAt: result.updatedAt,
      storage: result.migrationPending ? "local_fallback" : "server",
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}

type PutBody = {
  patch?: ConfirmedProfilePatch;
  localProfile?: unknown;
};

/**
 * PUT confirmed profile edits.
 * Validates on the server boundary, merges with any stored profile, and upserts
 * when beauty_profiles exists. Otherwise returns migrationPending + merged profile
 * for client local persistence (no Staging/Production write without migration).
 */
export async function PUT(request: Request) {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    let body: PutBody;
    try {
      body = (await request.json()) as PutBody;
    } catch {
      return careJsonFail(400, "INVALID_JSON", "요청 본문이 올바르지 않습니다.");
    }

    if (!body.patch || typeof body.patch !== "object") {
      return careJsonFail(400, "INVALID_PATCH", "프로필 수정 값이 필요합니다.");
    }

    const sanitized = sanitizeConfirmedProfilePatch(body.patch);
    if (!sanitized.ok) {
      return careJsonFail(400, "INVALID_PATCH", sanitized.message);
    }

    await ensureCareProfile(auth.userId);
    const client = await createSupabaseServerClient();
    const local = body.localProfile
      ? parseBeautyProfile(body.localProfile)
      : null;

    const result = await applyConfirmedPatchForUser(
      client,
      auth.userId,
      sanitized.patch,
      local
    );

    if (!result.ok) {
      if ("message" in result) {
        return careJsonFail(400, "INVALID_PATCH", result.message);
      }
      throw result.error;
    }

    return careJsonOk({
      profile: result.profile,
      migrationPending: result.migrationPending,
      mergedFromServer: result.mergedFromServer,
      storage: result.migrationPending ? "local_fallback" : "server",
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}

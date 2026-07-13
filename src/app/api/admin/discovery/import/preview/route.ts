import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { previewDiscoveryImport } from "@/lib/admin/import/preview";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/discovery/import/preview
 * Analyze URLs — no INSERT.
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
    }

    const payload = (body ?? {}) as Record<string, unknown>;
    const result = await previewDiscoveryImport(session, {
      urls: payload.urls,
      text: payload.text,
      overrides: payload.overrides as never,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

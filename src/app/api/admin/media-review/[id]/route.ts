import { type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";
import { getMediaReviewItem, submitMediaReview } from "@/lib/admin/mediaReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params?: Promise<Record<string, string | string[]>> };

async function readId(context: Ctx): Promise<string> {
  const params = (await context.params) ?? {};
  const raw = params.id;
  return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
}

/** GET /api/admin/media-review/[id] — one asset with its rights and checklist. */
export const GET = withAdminAuth(async (_request: NextRequest, context: Ctx) => {
  try {
    const result = await getMediaReviewItem(await readId(context));
    if (!result) return jsonFail(404, "NOT_FOUND", "영상을 찾을 수 없습니다.");
    if ("schemaReady" in result) {
      return jsonOk({ schemaReady: false, migrationPath: result.migrationPath });
    }
    return jsonOk({ schemaReady: true, item: result });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
});

/**
 * POST /api/admin/media-review/[id] — record a review decision.
 * Only admin and reviewer may decide. Approval is refused unless the asset is
 * actually publishable, so a reviewer cannot wave through expired rights.
 */
export const POST = withAdminAuth(
  async (request: NextRequest, context: Ctx, session) => {
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
      }

      const payload = (body ?? {}) as Record<string, unknown>;
      const result = await submitMediaReview(session, await readId(context), {
        decision: payload.decision,
        note: payload.note,
      });
      return jsonOk(result);
    } catch (error) {
      return jsonFromCaughtError(error);
    }
  },
  ["admin", "reviewer"]
);

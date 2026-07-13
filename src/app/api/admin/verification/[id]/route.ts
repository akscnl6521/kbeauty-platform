import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import {
  getAdminVerificationDetail,
  parseAdminVerificationId,
} from "@/lib/admin/verification-detail";
import { applyVerificationReview } from "@/lib/admin/verification-write";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

async function readId(context: RouteContext): Promise<string | null> {
  const params = (await context.params) ?? {};
  const rawId = params.id;
  return Array.isArray(rawId) ? rawId[0] ?? null : rawId ?? null;
}

/**
 * GET /api/admin/verification/[id]
 */
export const GET = withAdminAuth(
  async (_request: NextRequest, context: RouteContext) => {
    try {
      const queueId = parseAdminVerificationId(await readId(context));
      if (!queueId) {
        return jsonFail(400, "INVALID_INPUT", "Invalid verification queue id.");
      }

      const data = await getAdminVerificationDetail(queueId);
      if (!data) {
        return jsonFail(404, "NOT_FOUND", "Verification queue item not found.");
      }

      return jsonOk(data);
    } catch (error) {
      return jsonFromCaughtError(error);
    }
  },
  ADMIN_ROLES
);

/**
 * PATCH /api/admin/verification/[id] — review actions
 */
export const PATCH = withAdminAuth(
  async (request: NextRequest, context: RouteContext, session) => {
    try {
      const idValue = await readId(context);
      if (!idValue) {
        return jsonFail(400, "INVALID_INPUT", "Invalid verification queue id.");
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
      }

      const payload = (body ?? {}) as Record<string, unknown>;
      const result = await applyVerificationReview(session, idValue, {
        action: payload.action,
        reviewerNotes: payload.reviewerNotes ?? payload.reviewer_notes,
      });

      return jsonOk(result);
    } catch (error) {
      return jsonFromCaughtError(error);
    }
  },
  ADMIN_ROLES
);

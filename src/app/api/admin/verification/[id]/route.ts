import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import {
  getAdminVerificationDetail,
  parseAdminVerificationId,
} from "@/lib/admin/verification-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * Read-only admin verification queue detail.
 * GET /api/admin/verification/[id]
 */
export const GET = withAdminAuth(
  async (_request: NextRequest, context: RouteContext) => {
    try {
      const params = (await context.params) ?? {};
      const rawId = params.id;
      const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
      const queueId = parseAdminVerificationId(idValue);

      if (!queueId) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVALID_VERIFICATION_ID",
              message: "Invalid verification queue id.",
            },
          },
          { status: 400 }
        );
      }

      const data = await getAdminVerificationDetail(queueId);

      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "VERIFICATION_NOT_FOUND",
              message: "Verification queue item not found.",
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true, data });
    } catch (error) {
      if (isAdminAuthError(error)) {
        return NextResponse.json(
          {
            ok: false,
            error: { code: error.code, message: error.message },
          },
          { status: error.httpStatus }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VERIFICATION_DETAIL_UNAVAILABLE",
            message: "Unable to load admin verification detail.",
          },
        },
        { status: 500 }
      );
    }
  },
  ADMIN_ROLES
);

import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import {
  getAdminDiscoveryDetail,
  parseAdminDiscoveryId,
} from "@/lib/admin/discovery-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * Read-only admin discovery candidate detail.
 * GET /api/admin/discovery/[id]
 */
export const GET = withAdminAuth(
  async (_request: NextRequest, context: RouteContext) => {
    try {
      const params = (await context.params) ?? {};
      const rawId = params.id;
      const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
      const candidateId = parseAdminDiscoveryId(idValue);

      if (!candidateId) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVALID_DISCOVERY_ID",
              message: "Invalid discovery candidate id.",
            },
          },
          { status: 400 }
        );
      }

      const data = await getAdminDiscoveryDetail(candidateId);

      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "DISCOVERY_NOT_FOUND",
              message: "Discovery candidate not found.",
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
            code: "DISCOVERY_DETAIL_UNAVAILABLE",
            message: "Unable to load admin discovery detail.",
          },
        },
        { status: 500 }
      );
    }
  },
  ADMIN_ROLES
);

import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import {
  getAdminDiscoveryCandidates,
  parseAdminDiscoveryListParams,
} from "@/lib/admin/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only admin discovery candidate list.
 * Allowed: all admin roles. SELECT only.
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const params = parseAdminDiscoveryListParams(request.nextUrl.searchParams);
    const result = await getAdminDiscoveryCandidates(params);

    return NextResponse.json({
      ok: true,
      data: {
        items: result.items,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
        filters: result.filters,
      },
    });
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
          code: "DISCOVERY_UNAVAILABLE",
          message: "Unable to load admin discovery.",
        },
      },
      { status: 503 }
    );
  }
}, ADMIN_ROLES);

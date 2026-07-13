import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import {
  getAdminProducts,
  parseAdminProductListParams,
} from "@/lib/admin/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only admin product list.
 * Allowed: all admin roles. SELECT only. No ids of users / emails / tokens.
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const params = parseAdminProductListParams(request.nextUrl.searchParams);
    const result = await getAdminProducts(params);

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
          code: "PRODUCTS_UNAVAILABLE",
          message: "Unable to load admin products.",
        },
      },
      { status: 503 }
    );
  }
}, ADMIN_ROLES);

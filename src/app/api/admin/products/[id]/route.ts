import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import {
  getAdminProductDetail,
  parseAdminProductId,
} from "@/lib/admin/product-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * Read-only admin product detail.
 * GET /api/admin/products/[id]
 */
export const GET = withAdminAuth(
  async (_request: NextRequest, context: RouteContext) => {
    try {
      const params = (await context.params) ?? {};
      const rawId = params.id;
      const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
      const productId = parseAdminProductId(idValue);

      if (productId == null) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVALID_PRODUCT_ID",
              message: "Invalid product id.",
            },
          },
          { status: 400 }
        );
      }

      const data = await getAdminProductDetail(productId);

      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "PRODUCT_NOT_FOUND",
              message: "Product not found.",
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
            code: "PRODUCT_DETAIL_UNAVAILABLE",
            message: "Unable to load admin product detail.",
          },
        },
        { status: 500 }
      );
    }
  },
  ADMIN_ROLES
);

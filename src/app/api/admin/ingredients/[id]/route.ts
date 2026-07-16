import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import {
  getAdminIngredientDetail,
  parseAdminIngredientId,
} from "@/lib/admin/ingredient-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * Read-only admin ingredient detail.
 * GET /api/admin/ingredients/[id]
 */
export const GET = withAdminAuth(
  async (_request: NextRequest, context: RouteContext) => {
    try {
      const params = (await context.params) ?? {};
      const rawId = params.id;
      const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
      const ingredientId = parseAdminIngredientId(idValue);

      if (ingredientId == null) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVALID_INGREDIENT_ID",
              message: "Invalid ingredient id.",
            },
          },
          { status: 400 }
        );
      }

      const data = await getAdminIngredientDetail(ingredientId);

      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INGREDIENT_NOT_FOUND",
              message: "Ingredient not found.",
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
            code: "INGREDIENT_DETAIL_UNAVAILABLE",
            message: "Unable to load admin ingredient detail.",
          },
        },
        { status: 500 }
      );
    }
  },
  ADMIN_ROLES
);

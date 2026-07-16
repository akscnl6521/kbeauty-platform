import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getAdminOfferById } from "@/lib/admin/offers";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (_req, ctx) => {
  try {
    const params = await ctx.params;
    const id = String(params?.id ?? "");
    const item = await getAdminOfferById(id);
    if (!item) {
      return Response.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Offer not found" } },
        { status: 404 }
      );
    }
    return jsonOk({ item });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

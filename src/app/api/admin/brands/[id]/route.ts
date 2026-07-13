import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { seedBrandsFromCatalog } from "@/lib/pipeline/brand-discovery";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * GET /api/admin/brands/[id] — id is brandKey (normalized)
 */
export const GET = withAdminAuth(async (_request: NextRequest, context: RouteContext) => {
  try {
    const params = (await context.params) ?? {};
    const raw = params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id) return jsonFail(400, "INVALID_INPUT", "brand id 필요");
    const brandKey = decodeURIComponent(id);
    const brands = await seedBrandsFromCatalog(200);
    const brand = brands.find((b) => b.brandKey === brandKey);
    if (!brand) return jsonFail(404, "NOT_FOUND", "브랜드를 찾을 수 없습니다.");
    return jsonOk({ brand });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

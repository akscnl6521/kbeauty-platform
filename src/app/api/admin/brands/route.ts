import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { seedBrandsFromCatalog } from "@/lib/pipeline/brand-discovery";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/brands — seeded brand list from catalog
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    const brands = await seedBrandsFromCatalog(
      Number.isFinite(limit) ? Math.min(200, Math.max(1, limit)) : 50
    );
    return jsonOk({ items: brands });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

import { NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getAdminOffers } from "@/lib/admin/offers";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await getAdminOffers({
      verificationStatus: sp.get("verificationStatus") ?? undefined,
      stockStatus: sp.get("stockStatus") ?? undefined,
      country: sp.get("country") ?? undefined,
      official: sp.get("official") ?? undefined,
      limit: Number(sp.get("limit") ?? 50) || 50,
    });
    return jsonOk(data);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

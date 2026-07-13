import { NextResponse } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getAdminDashboardData } from "@/lib/admin/dashboard";
import { isAdminAuthError } from "@/lib/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only admin dashboard counts.
 * Allowed: all admin roles. No user ids / emails / SQL details.
 */
export const GET = withAdminAuth(async () => {
  try {
    const data = await getAdminDashboardData();
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
          code: "DASHBOARD_UNAVAILABLE",
          message: "Unable to load admin dashboard.",
        },
      },
      { status: 503 }
    );
  }
}, ADMIN_ROLES);

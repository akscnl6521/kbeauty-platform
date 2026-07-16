import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auth smoke-test endpoint. Returns role only — no userId, email, or tokens.
 */
export const GET = withAdminAuth(async (_request, _context, session) => {
  return NextResponse.json({
    ok: true,
    role: session.role,
  });
});

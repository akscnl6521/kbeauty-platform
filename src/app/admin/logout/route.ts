import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST-only admin logout. Clears Supabase auth cookies, then redirects to login.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/admin/login", url.origin), {
    status: 303,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST to sign out.",
      },
    },
    { status: 405 }
  );
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function logout(request: Request) {
  try { await (await createSupabaseServerClient()).auth.signOut(); } catch {}
  return NextResponse.redirect(new URL("/login", request.url));
}
export const GET = logout;
export const POST = logout;

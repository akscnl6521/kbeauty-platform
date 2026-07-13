import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_NEXT = "/admin/reset-password";
const FAILURE_PATH = "/admin/forgot-password?error=recovery_failed";

/**
 * Allow only same-origin relative paths. Blocks open redirects.
 */
function sanitizeNext(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith("/")) return DEFAULT_NEXT;
  if (raw.startsWith("//")) return DEFAULT_NEXT;
  if (raw.includes("://")) return DEFAULT_NEXT;
  if (raw.includes("\\")) return DEFAULT_NEXT;
  return raw;
}

/**
 * PKCE auth callback: exchange `code` for a cookie session, then redirect.
 * Used by admin password recovery (and reusable for other auth redirects).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  const failRedirect = NextResponse.redirect(new URL(FAILURE_PATH, origin));

  if (!code) {
    return failRedirect;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return failRedirect;
  }

  const successRedirect = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          successRedirect.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return failRedirect;
  }

  return successRedirect;
}

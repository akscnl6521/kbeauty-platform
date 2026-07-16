import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/safe-next";

const ADMIN_DEFAULT_NEXT = "/admin/reset-password";

/**
 * Allow only same-origin relative paths. Blocks open redirects.
 */
function createCookieClient(
  request: NextRequest,
  response: NextResponse,
  url: string,
  anonKey: string
) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

/**
 * Auth callback for admin password recovery.
 * Priority:
 * 1. token_hash + type=recovery → verifyOtp
 * 2. code → exchangeCodeForSession (PKCE fallback)
 * 3. otherwise → recovery_failed
 *
 * Never logs token_hash, code, email, or UUID.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const adminFlow = sanitizeNextPath(rawNext, "").startsWith("/admin");
  const defaultNext =
    type === "recovery"
      ? adminFlow
        ? ADMIN_DEFAULT_NEXT
        : "/reset-password"
      : type === "signup" || type === "email"
        ? "/auth/link-local?next=/onboarding"
        : "/my";
  const next = sanitizeNextPath(rawNext, defaultNext);
  const failurePath = adminFlow
    ? "/admin/forgot-password?error=recovery_failed"
    : `/auth/error?code=${type === "recovery" ? "recovery_failed" : "auth_failed"}`;
  const failRedirect = NextResponse.redirect(new URL(failurePath, origin));
  const successRedirect = NextResponse.redirect(new URL(next, origin));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return failRedirect;
  }

  const supabase = createCookieClient(request, successRedirect, url, anonKey);

  // A. Email-template recovery or email confirmation.
  if (tokenHash && (type === "recovery" || type === "signup" || type === "email")) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery" | "signup" | "email",
    });

    if (error) {
      return failRedirect;
    }

    return successRedirect;
  }

  // B. PKCE fallback: authorization code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return failRedirect;
    }

    return successRedirect;
  }

  return failRedirect;
}

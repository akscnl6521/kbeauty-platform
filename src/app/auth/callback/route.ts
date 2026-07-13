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
  const next = sanitizeNext(searchParams.get("next"));

  const failRedirect = NextResponse.redirect(new URL(FAILURE_PATH, origin));
  const successRedirect = NextResponse.redirect(new URL(next, origin));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return failRedirect;
  }

  const supabase = createCookieClient(request, successRedirect, url, anonKey);

  // A. Email-template recovery: token_hash + type=recovery
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
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

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeCustomerNextPath } from "@/lib/auth/safe-next";

/**
 * Next.js 16 proxy: shallow Supabase cookie refresh for admin, admin APIs,
 * and the PKCE auth callback path.
 * Sets x-pathname for admin layout public-path skip.
 * Does NOT query admin_users or decide roles.
 */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const loggedIn = Boolean(data.user);
  const isProtected = pathname.startsWith("/my") || pathname.startsWith("/onboarding");

  if (isProtected && !loggedIn) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  if ((pathname === "/login" || pathname === "/signup") && loggedIn) {
    const destination = sanitizeCustomerNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/my/:path*",
    "/api/care/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/logout",
    "/onboarding/:path*",
    "/auth/link-local",
    "/auth/callback",
  ],
};

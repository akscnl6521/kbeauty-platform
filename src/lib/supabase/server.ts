import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server session client (anon + cookie). For RSC / route handlers.
 * Service role is forbidden here.
 *
 * Empty public env during `next build` must not crash page collection.
 * Inert placeholders mirror legacy `src/lib/supabase.ts`; real session
 * lookups fail closed (null user) without valid keys.
 */
export async function createSupabaseServerClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://example.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "public-anon-key";

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Proxy is responsible for refreshing session cookies.
        }
      },
    },
  });
}

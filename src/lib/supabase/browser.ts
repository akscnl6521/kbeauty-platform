import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser / client-component Supabase client (anon key only).
 * Never import service-role keys here.
 *
 * Empty env is common in local/CI production builds. Use inert placeholders
 * (same approach as legacy `src/lib/supabase.ts`) so prerender does not throw;
 * real auth/data calls still fail safely without valid Staging/Production keys.
 */
export function createSupabaseBrowserClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://example.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "public-anon-key";

  return createBrowserClient(url, anonKey);
}

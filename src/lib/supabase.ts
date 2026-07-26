import { createClient } from "@supabase/supabase-js";

/**
 * Legacy shared anon client used by existing pages (results, ingredients, etc.).
 * Prefer `@/lib/supabase/browser` or `@/lib/supabase/server` for new code.
 * Do not add service-role usage here.
 *
 * Empty env is common in local/CI builds (e.g. sitemap collection). Use inert
 * placeholders so createClient does not throw; real calls still fail safely
 * without Production credentials.
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://example.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "public-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

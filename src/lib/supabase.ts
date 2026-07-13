import { createClient } from "@supabase/supabase-js";

/**
 * Legacy shared anon client used by existing pages (results, ingredients, etc.).
 * Prefer `@/lib/supabase/browser` or `@/lib/supabase/server` for new code.
 * Do not add service-role usage here.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

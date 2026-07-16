import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AdminConfigurationError } from "@/lib/auth/errors";

let adminClient: SupabaseClient | null = null;

/**
 * Server-only admin client (service role).
 * Lazily created on first call so missing env does not break unrelated builds/pages.
 * Never import this module from client components.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new AdminConfigurationError(
      "Admin database client is not configured."
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}

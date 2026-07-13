import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CareAuthUser = {
  userId: string;
};

/**
 * Verified auth user for care APIs (getUser, not session alone).
 */
export async function getCareAuthUser(): Promise<CareAuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  return { userId: data.user.id };
}

/**
 * Ensures profiles row exists for FK constraints. No email in logs.
 */
export async function ensureCareProfile(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    console.warn("[care] profile_upsert_failed");
  }
}

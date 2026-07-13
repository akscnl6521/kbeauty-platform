import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CustomerUser = { userId: string; email: string | null };

export async function getCustomerUser(): Promise<CustomerUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}

export async function requireCustomerUser(): Promise<CustomerUser> {
  const user = await getCustomerUser();
  if (!user) throw new Error("CUSTOMER_AUTH_REQUIRED");
  return user;
}

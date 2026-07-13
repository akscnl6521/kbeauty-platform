import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AdminAccessDeniedError,
  AdminConfigurationError,
  AdminInactiveError,
  AdminRoleDeniedError,
  AuthenticationRequiredError,
} from "@/lib/auth/errors";
import { isAdminRole, type AdminRole } from "@/lib/auth/roles";

export type AdminSession = {
  userId: string;
  role: AdminRole;
  active: true;
};

type AdminUserRow = {
  user_id: string;
  role: string;
  active: boolean;
};

/**
 * Verified Auth user via getUser() (not getSession alone).
 * Does not return email or tokens.
 */
export async function getAuthenticatedUser(): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    return null;
  }

  return { id: data.user.id };
}

/**
 * Loads admin_users via service-role server client.
 * Never reads profiles.role.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  let row: AdminUserRow | null = null;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_users")
      .select("user_id, role, active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new AdminConfigurationError("Unable to verify admin access.");
    }

    row = data as AdminUserRow | null;
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to verify admin access.");
  }

  if (!row) return null;
  if (!row.active) return null;
  if (!isAdminRole(row.role)) return null;

  return {
    userId: row.user_id,
    role: row.role,
    active: true,
  };
}

export async function requireAdminUser(): Promise<AdminSession> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthenticationRequiredError();
  }

  let row: AdminUserRow | null = null;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_users")
      .select("user_id, role, active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new AdminConfigurationError("Unable to verify admin access.");
    }

    row = data as AdminUserRow | null;
  } catch (error) {
    if (
      error instanceof AdminConfigurationError ||
      error instanceof AuthenticationRequiredError
    ) {
      throw error;
    }
    throw new AdminConfigurationError("Unable to verify admin access.");
  }

  if (!row) {
    throw new AdminAccessDeniedError();
  }

  if (!row.active) {
    throw new AdminInactiveError();
  }

  if (!isAdminRole(row.role)) {
    throw new AdminAccessDeniedError();
  }

  return {
    userId: row.user_id,
    role: row.role,
    active: true,
  };
}

export async function requireAdminRole(
  allowedRoles: readonly AdminRole[]
): Promise<AdminSession> {
  const session = await requireAdminUser();

  if (!allowedRoles.includes(session.role)) {
    throw new AdminRoleDeniedError();
  }

  return session;
}

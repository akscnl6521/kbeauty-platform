import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyCareCheckInsProbeError } from "@/lib/admin/care-ops";
import {
  applyConfirmedProfilePatch,
  mergeBeautyProfiles,
  parseBeautyProfile,
  sanitizeConfirmedProfilePatch,
  type BeautyProfile,
  type ConfirmedProfilePatch,
} from "@/lib/profile/beautyProfile";

export type BeautyProfileRow = {
  user_id: string;
  profile_version: number;
  profile: unknown;
  updated_at: string;
  created_at: string;
};

export function isBeautyProfileMigrationMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: string; message?: string };
  return classifyCareCheckInsProbeError(row) === "migration_missing";
}

export function profileFromRow(row: BeautyProfileRow | null): BeautyProfile | null {
  if (!row) return null;
  return parseBeautyProfile(row.profile, row.updated_at);
}

export async function readBeautyProfileForUser(
  client: SupabaseClient,
  userId: string
): Promise<
  | { ok: true; profile: BeautyProfile | null; migrationPending: false; updatedAt: string | null }
  | { ok: true; profile: null; migrationPending: true; updatedAt: null }
  | { ok: false; error: unknown }
> {
  const { data, error } = await client
    .from("beauty_profiles")
    .select("user_id, profile_version, profile, updated_at, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isBeautyProfileMigrationMissing(error)) {
      return { ok: true, profile: null, migrationPending: true, updatedAt: null };
    }
    return { ok: false, error };
  }

  const row = (data as BeautyProfileRow | null) ?? null;
  return {
    ok: true,
    profile: profileFromRow(row),
    migrationPending: false,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function upsertBeautyProfileForUser(
  client: SupabaseClient,
  userId: string,
  profile: BeautyProfile
): Promise<
  | { ok: true; profile: BeautyProfile; migrationPending: false }
  | { ok: true; profile: BeautyProfile; migrationPending: true }
  | { ok: false; error: unknown }
> {
  const safe = parseBeautyProfile(profile);
  const payload = {
    user_id: userId,
    profile_version: 1,
    profile: safe,
    updated_at: safe.updatedAt,
  };

  const { data, error } = await client
    .from("beauty_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, profile_version, profile, updated_at, created_at")
    .single();

  if (error) {
    if (isBeautyProfileMigrationMissing(error)) {
      return { ok: true, profile: safe, migrationPending: true };
    }
    return { ok: false, error };
  }

  return {
    ok: true,
    profile: profileFromRow(data as BeautyProfileRow) ?? safe,
    migrationPending: false,
  };
}

/** Apply a confirmed patch onto local+server merged base, then upsert when available. */
export async function applyConfirmedPatchForUser(
  client: SupabaseClient,
  userId: string,
  patch: ConfirmedProfilePatch,
  localProfile?: BeautyProfile | null
): Promise<
  | {
      ok: true;
      profile: BeautyProfile;
      migrationPending: boolean;
      mergedFromServer: boolean;
    }
  | { ok: false; message: string }
  | { ok: false; error: unknown }
> {
  const sanitized = sanitizeConfirmedProfilePatch(patch);
  if (!sanitized.ok) return { ok: false, message: sanitized.message };

  const existing = await readBeautyProfileForUser(client, userId);
  if (!existing.ok) return { ok: false, error: existing.error };

  const local = localProfile ? parseBeautyProfile(localProfile) : null;
  const server = existing.migrationPending ? null : existing.profile;
  const base =
    local && server
      ? mergeBeautyProfiles(local, server)
      : local ?? server ?? parseBeautyProfile(null);

  const next = applyConfirmedProfilePatch(base, sanitized.patch);
  const saved = await upsertBeautyProfileForUser(client, userId, next);
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    profile: saved.profile,
    migrationPending: existing.migrationPending || saved.migrationPending,
    mergedFromServer: Boolean(server),
  };
}

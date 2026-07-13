import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";

/**
 * Privacy-safe care aggregates for admins.
 * Never returns email, UID, free memo, photos, or health free-text.
 */
export type AdminCareOpsSummary = {
  tablesReady: boolean;
  scheduledCheckIns: number;
  dueCheckIns: number;
  completedCheckIns: number;
  expiredCheckIns: number;
  completionRate: number;
  referralPromptly: number;
  referralEmergency: number;
  routinesSaved: number;
  feedbackCount: number;
  note: string;
};

export async function getAdminCareOpsSummary(): Promise<AdminCareOpsSummary> {
  let client: ReturnType<typeof createSupabaseAdminClient>;
  try {
    client = createSupabaseAdminClient();
  } catch (e) {
    if (e instanceof AdminConfigurationError) throw e;
    throw new AdminConfigurationError("Unable to load care ops.");
  }

  const base: AdminCareOpsSummary = {
    tablesReady: false,
    scheduledCheckIns: 0,
    dueCheckIns: 0,
    completedCheckIns: 0,
    expiredCheckIns: 0,
    completionRate: 0,
    referralPromptly: 0,
    referralEmergency: 0,
    routinesSaved: 0,
    feedbackCount: 0,
    note: "care migration not applied — aggregates unavailable until approved",
  };

  const { error } = await client.from("care_check_ins").select("id").limit(1);
  if (error) return base;

  async function count(status?: string) {
    let q = client.from("care_check_ins").select("id", { count: "exact", head: true });
    if (status) q = q.eq("status", status);
    const { count } = await q;
    return count ?? 0;
  }

  const [scheduled, due, completed, expired, promptly, emergency, routines, feedback] =
    await Promise.all([
      count("scheduled"),
      count("due"),
      count("completed"),
      count("expired"),
      client
        .from("care_check_ins")
        .select("id", { count: "exact", head: true })
        .eq("referral_level", "seek_promptly")
        .then((r) => r.count ?? 0),
      client
        .from("care_check_ins")
        .select("id", { count: "exact", head: true })
        .eq("referral_level", "seek_emergency_care")
        .then((r) => r.count ?? 0),
      client
        .from("care_routines")
        .select("id", { count: "exact", head: true })
        .then((r) => r.count ?? 0),
      client
        .from("care_feedback")
        .select("id", { count: "exact", head: true })
        .then((r) => r.count ?? 0),
    ]);

  const denom = completed + due + scheduled + expired;
  return {
    tablesReady: true,
    scheduledCheckIns: scheduled,
    dueCheckIns: due,
    completedCheckIns: completed,
    expiredCheckIns: expired,
    completionRate: denom > 0 ? completed / denom : 0,
    referralPromptly: promptly,
    referralEmergency: emergency,
    routinesSaved: routines,
    feedbackCount: feedback,
    note: "counts only — no PII",
  };
}

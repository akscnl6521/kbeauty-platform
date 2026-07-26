import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";

export type CareReadinessStatus =
  | "ready"
  | "migration_missing"
  | "permission_missing"
  | "query_error";

export type CareProbeError = {
  code?: string | null;
  message?: string | null;
};

export function classifyCareCheckInsProbeError(
  error: CareProbeError | null | undefined
): CareReadinessStatus {
  if (!error) return "ready";

  const code = (error.code ?? "").trim();
  const message = (error.message ?? "").trim().toLowerCase();

  if (code === "42501") {
    return "permission_missing";
  }

  if (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("could not find the table") ||
    message.includes("does not exist") ||
    (message.includes("relation") && message.includes("does not exist"))
  ) {
    return "migration_missing";
  }

  return "query_error";
}

export function careReadinessNote(status: CareReadinessStatus): string {
  switch (status) {
    case "ready":
      return "counts only — no PII";
    case "migration_missing":
      return "Care database migration is not applied.";
    case "permission_missing":
      return "Care tables exist, but the admin service role does not have read permission.";
    case "query_error":
      return "Care aggregates could not be loaded.";
  }
}

const K_ANON_MIN = 3;

function kAnonCount(count: number): number | null {
  return count < K_ANON_MIN ? null : count;
}

function kAnonNote(hidden: boolean): string | null {
  return hidden ? `count < ${K_ANON_MIN} — hidden for k-anonymity` : null;
}

/**
 * Privacy-safe care aggregates for admins.
 * Never returns email, UID, free memo, photos, or health free-text.
 */
export type AdminCareOpsSummary = {
  tablesReady: boolean;
  readinessStatus: CareReadinessStatus;
  scheduledCheckIns: number | null;
  dueCheckIns: number | null;
  completedCheckIns: number | null;
  expiredCheckIns: number | null;
  skippedCheckIns: number | null;
  completionRate: number | null;
  referralConsiderSoon: number | null;
  referralPromptly: number | null;
  referralEmergency: number | null;
  routinesSaved: number | null;
  routinesActive: number | null;
  feedbackCount: number | null;
  suggestionsPending: number | null;
  notificationsUnread: number | null;
  sessionsLinked: number | null;
  progressSnapshots: number | null;
  note: string;
  kAnonymityNotes: string[];
};

export type AdminCareCheckInsByDay = {
  tablesReady: boolean;
  readinessStatus: CareReadinessStatus;
  byStatus: Record<string, number | null>;
  byDay: Array<{ day: number; count: number | null; note: string | null }>;
  note: string;
};

export type AdminCareAlerts = {
  tablesReady: boolean;
  readinessStatus: CareReadinessStatus;
  dueCheckIns: number | null;
  expiredCheckIns: number | null;
  referralPromptly: number | null;
  referralEmergency: number | null;
  unreadNotifications: number | null;
  note: string;
  kAnonymityNotes: string[];
};

export type AdminCareEngagement = {
  tablesReady: boolean;
  readinessStatus: CareReadinessStatus;
  completionRate: number | null;
  avgCheckInsPerSession: number | null;
  activeRoutines: number | null;
  feedbackCount: number | null;
  acceptedSuggestions: number | null;
  note: string;
  kAnonymityNotes: string[];
};

async function getAdminClient() {
  try {
    return createSupabaseAdminClient();
  } catch (e) {
    if (e instanceof AdminConfigurationError) throw e;
    throw new AdminConfigurationError("Unable to load care ops.");
  }
}

async function probeCareReadiness(
  client: ReturnType<typeof createSupabaseAdminClient>
): Promise<CareReadinessStatus> {
  const { error } = await client.from("care_check_ins").select("id").limit(1);
  return classifyCareCheckInsProbeError(error);
}

async function countTable(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  eq?: Array<[string, string | number | boolean]>
): Promise<number> {
  let q = client.from(table).select("id", { count: "exact", head: true });
  for (const [col, val] of eq ?? []) {
    q = q.eq(col, val);
  }
  const { count } = await q;
  return count ?? 0;
}

export async function getAdminCareOpsSummary(): Promise<AdminCareOpsSummary> {
  const client = await getAdminClient();
  const notes: string[] = [];
  const readinessStatus = await probeCareReadiness(client);
  const base: AdminCareOpsSummary = {
    tablesReady: false,
    readinessStatus,
    scheduledCheckIns: null,
    dueCheckIns: null,
    completedCheckIns: null,
    expiredCheckIns: null,
    skippedCheckIns: null,
    completionRate: null,
    referralConsiderSoon: null,
    referralPromptly: null,
    referralEmergency: null,
    routinesSaved: null,
    routinesActive: null,
    feedbackCount: null,
    suggestionsPending: null,
    notificationsUnread: null,
    sessionsLinked: null,
    progressSnapshots: null,
    note: careReadinessNote(readinessStatus),
    kAnonymityNotes: [],
  };

  if (readinessStatus !== "ready") return base;

  const [
    scheduled,
    due,
    completed,
    expired,
    skipped,
    consider,
    promptly,
    emergency,
    routines,
    routinesActive,
    feedback,
    suggestions,
    notifications,
    sessions,
    snapshots,
  ] = await Promise.all([
    countTable(client, "care_check_ins", [["status", "scheduled"]]),
    countTable(client, "care_check_ins", [["status", "due"]]),
    countTable(client, "care_check_ins", [["status", "completed"]]),
    countTable(client, "care_check_ins", [["status", "expired"]]),
    countTable(client, "care_check_ins", [["status", "skipped"]]),
    countTable(client, "care_check_ins", [["referral_level", "consider_soon"]]),
    countTable(client, "care_check_ins", [["referral_level", "seek_promptly"]]),
    countTable(client, "care_check_ins", [["referral_level", "seek_emergency_care"]]),
    countTable(client, "care_routines"),
    countTable(client, "care_routines", [["status", "active"]]),
    countTable(client, "care_feedback"),
    countTable(client, "care_suggestions", [["status", "pending"]]),
    countTable(client, "care_notifications", [["status", "unread"]]),
    countTable(client, "care_analysis_sessions", [["linked_account", true]]),
    countTable(client, "care_progress_snapshots"),
  ]);

  const denom = completed + due + scheduled + expired + skipped;
  const completionRate = denom > 0 ? completed / denom : 0;

  const fields = [
    scheduled,
    due,
    completed,
    expired,
    skipped,
    consider,
    promptly,
    emergency,
    routines,
    routinesActive,
    feedback,
    suggestions,
    notifications,
    sessions,
    snapshots,
  ];
  for (const c of fields) {
    const note = kAnonNote(c < K_ANON_MIN);
    if (note) notes.push(note);
  }

  return {
    tablesReady: true,
    readinessStatus: "ready",
    scheduledCheckIns: kAnonCount(scheduled),
    dueCheckIns: kAnonCount(due),
    completedCheckIns: kAnonCount(completed),
    expiredCheckIns: kAnonCount(expired),
    skippedCheckIns: kAnonCount(skipped),
    completionRate: completed >= K_ANON_MIN ? completionRate : null,
    referralConsiderSoon: kAnonCount(consider),
    referralPromptly: kAnonCount(promptly),
    referralEmergency: kAnonCount(emergency),
    routinesSaved: kAnonCount(routines),
    routinesActive: kAnonCount(routinesActive),
    feedbackCount: kAnonCount(feedback),
    suggestionsPending: kAnonCount(suggestions),
    notificationsUnread: kAnonCount(notifications),
    sessionsLinked: kAnonCount(sessions),
    progressSnapshots: kAnonCount(snapshots),
    note: "counts only — no PII",
    kAnonymityNotes: [...new Set(notes)],
  };
}

export async function getAdminCareCheckInsByDay(): Promise<AdminCareCheckInsByDay> {
  const client = await getAdminClient();
  const readinessStatus = await probeCareReadiness(client);
  const base: AdminCareCheckInsByDay = {
    tablesReady: false,
    readinessStatus,
    byStatus: {},
    byDay: [],
    note: careReadinessNote(readinessStatus),
  };

  if (readinessStatus !== "ready") return base;

  const statuses = ["scheduled", "due", "completed", "skipped", "expired"];
  const byStatus: Record<string, number | null> = {};
  for (const status of statuses) {
    const c = await countTable(client, "care_check_ins", [["status", status]]);
    byStatus[status] = kAnonCount(c);
  }

  const days = [3, 7, 15, 30];
  const byDay = await Promise.all(
    days.map(async (day) => {
      const c = await countTable(client, "care_check_ins", [["day", day]]);
      return {
        day,
        count: kAnonCount(c),
        note: kAnonNote(c < K_ANON_MIN),
      };
    })
  );

  return {
    tablesReady: true,
    readinessStatus: "ready",
    byStatus,
    byDay,
    note: "status/day counts only — no user identifiers",
  };
}

export async function getAdminCareAlerts(): Promise<AdminCareAlerts> {
  const summary = await getAdminCareOpsSummary();
  return {
    tablesReady: summary.tablesReady,
    readinessStatus: summary.readinessStatus,
    dueCheckIns: summary.dueCheckIns,
    expiredCheckIns: summary.expiredCheckIns,
    referralPromptly: summary.referralPromptly,
    referralEmergency: summary.referralEmergency,
    unreadNotifications: summary.notificationsUnread,
    note: summary.note,
    kAnonymityNotes: summary.kAnonymityNotes,
  };
}

export async function getAdminCareEngagement(): Promise<AdminCareEngagement> {
  const client = await getAdminClient();
  const notes: string[] = [];
  const readinessStatus = await probeCareReadiness(client);
  const base: AdminCareEngagement = {
    tablesReady: false,
    readinessStatus,
    completionRate: null,
    avgCheckInsPerSession: null,
    activeRoutines: null,
    feedbackCount: null,
    acceptedSuggestions: null,
    note: careReadinessNote(readinessStatus),
    kAnonymityNotes: [],
  };

  if (readinessStatus !== "ready") return base;

  const [completed, total, sessions, activeRoutines, feedback, accepted] =
    await Promise.all([
      countTable(client, "care_check_ins", [["status", "completed"]]),
      countTable(client, "care_check_ins"),
      countTable(client, "care_analysis_sessions"),
      countTable(client, "care_routines", [["status", "active"]]),
      countTable(client, "care_feedback"),
      countTable(client, "care_suggestions", [["status", "accepted"]]),
    ]);

  const completionRate = total > 0 ? completed / total : null;
  const avgCheckInsPerSession =
    sessions > 0 ? completed / sessions : null;

  for (const c of [completed, sessions, activeRoutines, feedback, accepted]) {
    const note = kAnonNote(c < K_ANON_MIN);
    if (note) notes.push(note);
  }

  return {
    tablesReady: true,
    readinessStatus: "ready",
    completionRate:
      completed >= K_ANON_MIN && total >= K_ANON_MIN ? completionRate : null,
    avgCheckInsPerSession:
      completed >= K_ANON_MIN && sessions >= K_ANON_MIN
        ? avgCheckInsPerSession
        : null,
    activeRoutines: kAnonCount(activeRoutines),
    feedbackCount: kAnonCount(feedback),
    acceptedSuggestions: kAnonCount(accepted),
    note: "engagement aggregates — counts only",
    kAnonymityNotes: [...new Set(notes)],
  };
}

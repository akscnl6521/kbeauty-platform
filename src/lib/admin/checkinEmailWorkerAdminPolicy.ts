/**
 * Pure policy for Care check-in email worker admin ops.
 * Dry-run / retry / cancel only — never live provider.
 */

export const CARE_WORKER_ADMIN_CONFIRM_TOKEN = "CONFIRM" as const;

export const PRODUCTION_SUPABASE_PROJECT_REF = "rhfrmvkjsummaylpzmns";
export const STAGING_SUPABASE_PROJECT_REF = "jfnjufmldiqlgvgyugfd";

export type CareWorkerAdminSafeAction =
  | "dry_run_tick"
  | "manual_retry"
  | "manual_cancel";

const SAFE_ACTIONS = new Set<CareWorkerAdminSafeAction>([
  "dry_run_tick",
  "manual_retry",
  "manual_cancel",
]);

export type CareWorkerAdminEnvGate =
  | { ok: true }
  | { ok: false; code: string; httpStatus: 403 | 404 };

export function extractSupabaseProjectRefFromUrl(
  url: string | undefined
): string | null {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

export function assertCareWorkerAdminEnvironmentAllowed(
  env: Record<string, string | undefined>
): CareWorkerAdminEnvGate {
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  const appEnv = (env.APP_ENV ?? "").trim().toLowerCase();

  if (vercelEnv === "production" || appEnv === "production") {
    return { ok: false, code: "production_blocked", httpStatus: 404 };
  }

  const fromUrl = extractSupabaseProjectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const fromEnv = (env.SUPABASE_PROJECT_REF ?? "").trim();
  const resolvedRef = fromUrl ?? (fromEnv || null);

  if (resolvedRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    return { ok: false, code: "production_ref_blocked", httpStatus: 403 };
  }

  return { ok: true };
}

export function isCareWorkerAdminConfirmToken(value: unknown): boolean {
  return typeof value === "string" && value === CARE_WORKER_ADMIN_CONFIRM_TOKEN;
}

export function parseCareWorkerAdminAction(
  value: unknown
): CareWorkerAdminSafeAction | null {
  if (typeof value !== "string") return null;
  if (!SAFE_ACTIONS.has(value as CareWorkerAdminSafeAction)) return null;
  return value as CareWorkerAdminSafeAction;
}

/**
 * manual_retry: only from DB status `failed`.
 * Optionally allow `cancelled` when allowCancelled=true.
 * On admin retry: reset retry_count to 0 and clear last_error.
 */
export function canManualRetryCheckinEmailJob(input: {
  status: string;
  allowCancelled?: boolean;
}): { ok: true } | { ok: false; code: string } {
  if (input.status === "failed") return { ok: true };
  if (input.allowCancelled && input.status === "cancelled") return { ok: true };
  return { ok: false, code: "retry_status_not_allowed" };
}

/**
 * manual_cancel: only pending or processing → cancelled.
 */
export function canManualCancelCheckinEmailJob(input: {
  status: string;
}): { ok: true } | { ok: false; code: string } {
  if (input.status === "pending" || input.status === "processing") {
    return { ok: true };
  }
  return { ok: false, code: "cancel_status_not_allowed" };
}

export type CareWorkerAdminActionBody = {
  action: CareWorkerAdminSafeAction;
  confirm: typeof CARE_WORKER_ADMIN_CONFIRM_TOKEN;
  jobId?: string;
  limit?: number;
  staleSeconds?: number;
  allowCancelledRetry?: boolean;
};

export function parseCareWorkerAdminActionBody(
  body: unknown
):
  | { ok: true; value: CareWorkerAdminActionBody }
  | { ok: false; code: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, code: "invalid_body" };
  }
  const record = body as Record<string, unknown>;

  const forbidden = [
    "recipient",
    "email",
    "payload",
    "apiKey",
    "provider",
    "to",
    "from",
  ];
  for (const key of forbidden) {
    if (key in record) return { ok: false, code: "forbidden_field" };
  }

  const action = parseCareWorkerAdminAction(record.action);
  if (!action) return { ok: false, code: "invalid_action" };

  if (!isCareWorkerAdminConfirmToken(record.confirm)) {
    return { ok: false, code: "confirmation_required" };
  }

  const result: CareWorkerAdminActionBody = {
    action,
    confirm: CARE_WORKER_ADMIN_CONFIRM_TOKEN,
  };

  if (action === "manual_retry" || action === "manual_cancel") {
    if (typeof record.jobId !== "string" || !record.jobId.trim()) {
      return { ok: false, code: "job_id_required" };
    }
    result.jobId = record.jobId.trim();
  }

  if (action === "dry_run_tick") {
    if (record.limit !== undefined) {
      const n = Number(record.limit);
      if (!Number.isFinite(n) || n < 1 || n > 50) {
        return { ok: false, code: "invalid_limit" };
      }
      result.limit = Math.floor(n);
    }
    if (record.staleSeconds !== undefined) {
      const n = Number(record.staleSeconds);
      if (!Number.isFinite(n) || n < 60 || n > 86400) {
        return { ok: false, code: "invalid_stale_seconds" };
      }
      result.staleSeconds = Math.floor(n);
    }
  }

  if (action === "manual_retry" && record.allowCancelledRetry === true) {
    result.allowCancelledRetry = true;
  }

  return { ok: true, value: result };
}
export const FORBIDDEN_SNAPSHOT_KEYS = new Set([
  "recipient",
  "recipient_email",
  "recipient_mask",
  "payload",
  "user_id",
  "email",
  "to",
  "from",
  "api_key",
  "authorization",
]);

export function assertSnapshotHasNoPiiFields(
  value: unknown,
  path = "root"
): { ok: true } | { ok: false; path: string; key: string } {
  if (value === null || value === undefined) return { ok: true };
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = assertSnapshotHasNoPiiFields(value[i], path + "[" + i + "]");
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_SNAPSHOT_KEYS.has(k.toLowerCase())) {
        return { ok: false, path, key: k };
      }
      const r = assertSnapshotHasNoPiiFields(v, path + "." + k);
      if (!r.ok) return r;
    }
  }
  return { ok: true };
}

const MAX_ACTIONS_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

export interface CareWorkerAdminRateLimitStore {
  getTimes(key: string): number[];
  setTimes(key: string, times: number[]): void;
}

class InMemoryCareWorkerAdminRateLimitStore
  implements CareWorkerAdminRateLimitStore
{
  private map = new Map<string, number[]>();
  getTimes(key: string): number[] {
    return this.map.get(key) ?? [];
  }
  setTimes(key: string, times: number[]): void {
    this.map.set(key, times);
  }
}

export class InMemoryCareWorkerAdminRateLimiter {
  constructor(
    private readonly store: CareWorkerAdminRateLimitStore = new InMemoryCareWorkerAdminRateLimitStore(),
    private readonly maxPerMinute = MAX_ACTIONS_PER_MINUTE
  ) {}

  check(
    adminSubject: string,
    now: Date = new Date()
  ): { ok: true } | { ok: false; code: string } {
    const at = now.getTime();
    const windowStart = at - WINDOW_MS;
    const recent = this.store
      .getTimes(adminSubject)
      .filter((ts) => ts >= windowStart);
    if (recent.length >= this.maxPerMinute) {
      return { ok: false, code: "rate_limit_per_minute" };
    }
    return { ok: true };
  }

  record(adminSubject: string, now: Date = new Date()): void {
    const at = now.getTime();
    const windowStart = at - WINDOW_MS;
    const recent = this.store
      .getTimes(adminSubject)
      .filter((ts) => ts >= windowStart);
    recent.push(at);
    this.store.setTimes(adminSubject, recent);
  }
}

/** Shared process-local limiter for API routes (mirrors preview test-send). */
export const careWorkerAdminRateLimiter =
  new InMemoryCareWorkerAdminRateLimiter();

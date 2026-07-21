/**
 * In-memory fake queue DB for concurrency / retry unit tests.
 * Mirrors claim SKIP LOCKED semantics without PostgreSQL.
 */

import type {
  CheckinEmailQueueDb,
  CheckinEmailQueueRow,
} from "@/lib/retention/checkinEmailQueuePersistence";
import type { DbCheckinEmailQueueStatus } from "@/lib/retention/checkinEmailQueueStatusMap";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export class FakeCheckinEmailQueueDb implements CheckinEmailQueueDb {
  rows = new Map<string, CheckinEmailQueueRow>();
  claimLocks = new Set<string>();

  seed(row: CheckinEmailQueueRow): void {
    this.rows.set(row.id, clone(row));
  }

  from(table: string) {
    if (table !== "checkin_email_queue") {
      throw new Error(`unknown_table:${table}`);
    }
    const self = this;
    return {
      select(_columns?: string) {
        return {
          eq(column: string, value: string) {
            return {
              async maybeSingle() {
                if (column === "idempotency_key") {
                  for (const row of self.rows.values()) {
                    if (row.idempotency_key === value) {
                      return { data: clone(row), error: null };
                    }
                  }
                  return { data: null, error: null };
                }
                if (column === "id") {
                  const row = self.rows.get(value) ?? null;
                  return { data: row ? clone(row) : null, error: null };
                }
                return { data: null, error: { message: "unsupported_eq" } };
              },
            };
          },
        };
      },
      insert(values: Record<string, unknown>) {
        return {
          select(_columns?: string) {
            return {
              async single() {
                for (const row of self.rows.values()) {
                  if (row.idempotency_key === values.idempotency_key) {
                    return {
                      data: null as unknown as CheckinEmailQueueRow,
                      error: { message: "duplicate", code: "23505" },
                    };
                  }
                }
                const id =
                  typeof values.id === "string"
                    ? values.id
                    : `fake-${self.rows.size + 1}`;
                const now = new Date().toISOString();
                const row: CheckinEmailQueueRow = {
                  id,
                  user_id: String(values.user_id),
                  checkin_id: String(values.checkin_id),
                  milestone: values.milestone as CheckinEmailQueueRow["milestone"],
                  kind: values.kind as CheckinEmailQueueRow["kind"],
                  channel: "email",
                  status: (values.status as DbCheckinEmailQueueStatus) ?? "pending",
                  idempotency_key: String(values.idempotency_key),
                  recipient_mask: String(values.recipient_mask),
                  locale: String(values.locale ?? "ko"),
                  timezone: String(values.timezone),
                  template_version: String(values.template_version ?? "v1"),
                  payload: (values.payload as CheckinEmailQueueRow["payload"]) ?? {},
                  provider_message_id:
                    (values.provider_message_id as string | null) ?? null,
                  retry_count: Number(values.retry_count ?? 0),
                  last_error: (values.last_error as string | null) ?? null,
                  next_attempt_at:
                    (values.next_attempt_at as string | null) ?? null,
                  created_at: String(values.created_at ?? now),
                  updated_at: String(values.updated_at ?? now),
                  scheduled_at: (values.scheduled_at as string | null) ?? null,
                  claimed_at: (values.claimed_at as string | null) ?? null,
                  sent_at: (values.sent_at as string | null) ?? null,
                  failed_at: (values.failed_at as string | null) ?? null,
                };
                self.rows.set(id, row);
                return { data: clone(row), error: null };
              },
            };
          },
        };
      },
      update(values: Record<string, unknown>) {
        return {
          eq(column: string, value: string) {
            return {
              select(_columns?: string) {
                return {
                  async maybeSingle() {
                    if (column !== "id") {
                      return {
                        data: null,
                        error: { message: "unsupported_update_eq" },
                      };
                    }
                    const existing = self.rows.get(value);
                    if (!existing) {
                      return { data: null, error: { message: "not_found" } };
                    }
                    const next = {
                      ...existing,
                      ...values,
                    } as CheckinEmailQueueRow;
                    self.rows.set(value, next);
                    return { data: clone(next), error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  async rpc(fn: string, args?: Record<string, unknown>) {
    if (fn !== "claim_checkin_email_jobs") {
      return { data: null, error: { message: `unknown_rpc:${fn}` } };
    }
    const limit = Math.min(50, Math.max(1, Number(args?.p_limit ?? 5)));
    const staleSeconds = Math.max(60, Number(args?.p_stale_seconds ?? 900));
    const now = Date.now();

    for (const row of this.rows.values()) {
      if (row.status !== "processing") continue;
      const claimedMs = row.claimed_at
        ? Date.parse(row.claimed_at)
        : Number.NaN;
      if (
        !row.claimed_at ||
        !Number.isFinite(claimedMs) ||
        claimedMs < now - staleSeconds * 1000
      ) {
        row.status = "pending";
        row.claimed_at = null;
        row.updated_at = new Date().toISOString();
        row.last_error = row.last_error || "stale_claim_recovered";
      }
    }

    const candidates = [...this.rows.values()]
      .filter((row) => {
        if (row.status !== "pending") return false;
        if (this.claimLocks.has(row.id)) return false;
        if (!row.next_attempt_at) return true;
        return Date.parse(row.next_attempt_at) <= now;
      })
      .sort((a, b) => {
        const ta = Date.parse(
          a.next_attempt_at ?? a.scheduled_at ?? a.created_at
        );
        const tb = Date.parse(
          b.next_attempt_at ?? b.scheduled_at ?? b.created_at
        );
        return ta - tb;
      })
      .slice(0, limit);

    const claimed: CheckinEmailQueueRow[] = [];
    for (const row of candidates) {
      // Simulate SKIP LOCKED: if already locked by concurrent claim, skip.
      if (this.claimLocks.has(row.id)) continue;
      this.claimLocks.add(row.id);
      const ts = new Date().toISOString();
      row.status = "processing";
      row.claimed_at = ts;
      row.updated_at = ts;
      claimed.push(clone(row));
      // Release lock after claim completes (row is processing).
      this.claimLocks.delete(row.id);
    }
    return { data: claimed, error: null };
  }

  /** Hold a lock during an overlapping claim to assert SKIP LOCKED behavior. */
  async withHeldLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    this.claimLocks.add(id);
    try {
      return await fn();
    } finally {
      this.claimLocks.delete(id);
    }
  }
}

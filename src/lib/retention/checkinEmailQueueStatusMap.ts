/**
 * Map in-memory check-in email queue statuses to DB Schema A statuses.
 * Memory statuses remain in checkinEmailQueuePolicy for eligibility/retry logic.
 */

import type { CheckinEmailQueueStatus } from "@/lib/retention/checkinEmailQueuePolicy";

export type DbCheckinEmailQueueStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "skipped_duplicate"
  | "cancelled";

export const DB_CHECKIN_EMAIL_QUEUE_STATUSES: ReadonlySet<DbCheckinEmailQueueStatus> =
  new Set([
    "pending",
    "processing",
    "sent",
    "failed",
    "skipped_duplicate",
    "cancelled",
  ]);

/**
 * Memory → DB mapping (confirmed):
 * scheduled → pending
 * sending → processing
 * sent → sent
 * retry_scheduled → pending (+ retry_count / scheduled_at handled by caller)
 * failed → failed
 * duplicate → skipped_duplicate
 * cancelled → cancelled
 * pending → pending
 * suppressed / dead_letter → cancelled / failed
 */
export function memoryStatusToDbStatus(
  status: CheckinEmailQueueStatus | "duplicate"
): DbCheckinEmailQueueStatus {
  switch (status) {
    case "pending":
    case "scheduled":
    case "retry_scheduled":
      return "pending";
    case "sending":
      return "processing";
    case "sent":
      return "sent";
    case "failed":
      return "failed";
    case "duplicate":
      return "skipped_duplicate";
    case "cancelled":
    case "suppressed":
      return "cancelled";
    case "dead_letter":
      return "failed";
    default:
      return "failed";
  }
}

export function dbStatusToMemoryStatus(
  status: DbCheckinEmailQueueStatus
): CheckinEmailQueueStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "processing":
      return "sending";
    case "sent":
      return "sent";
    case "failed":
      return "failed";
    case "skipped_duplicate":
      return "dead_letter";
    case "cancelled":
      return "cancelled";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function isDbTerminalStatus(status: DbCheckinEmailQueueStatus): boolean {
  return (
    status === "sent" ||
    status === "failed" ||
    status === "skipped_duplicate" ||
    status === "cancelled"
  );
}

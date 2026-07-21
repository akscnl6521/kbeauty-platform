/**
 * Dry-run worker for Staging check-in email queue.
 * Never calls a live email provider. Provider call count stays 0 unless injected dry-run.
 */

import {
  claimCheckinEmailJobs,
  markCheckinEmailCancelled,
  markCheckinEmailFailed,
  markCheckinEmailSent,
  rowToQueueItem,
  type CheckinEmailQueueDb,
  type CheckinEmailQueueRow,
} from "@/lib/retention/checkinEmailQueuePersistence";
import { processCheckinEmailDryRun } from "@/lib/retention/processCheckinEmailDryRun";
import type { EmailProvider } from "@/lib/email/provider/types";

export type CheckinEmailDryRunWorkerResult = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
  cancelled: number;
  providerCalls: number;
  rows: Array<{
    id: string;
    status: string;
    outcome: string;
    reasonCode: string;
  }>;
};

/**
 * Reject any provider that would hit the network.
 * Dry-run injects a counting wrapper; live transports are refused.
 */
function assertDryRunOnlyProvider(provider: EmailProvider | undefined): void {
  if (!provider) return;
  const name = provider.name ?? "";
  if (name === "resend" || name === "live") {
    throw new Error("dry_run_worker_rejects_live_provider");
  }
}

export async function runCheckinEmailQueueDryRunWorker(input: {
  db: CheckinEmailQueueDb;
  limit?: number;
  staleSeconds?: number;
  /** Synthetic recipient for dry-run only; never persisted. */
  recipientEmail?: string;
  careCheckinConsent?: boolean;
  careEmailChannelConsent?: boolean;
  provider?: EmailProvider;
}): Promise<CheckinEmailDryRunWorkerResult> {
  assertDryRunOnlyProvider(input.provider);

  let providerCalls = 0;
  const countingProvider: EmailProvider | undefined = input.provider
    ? {
        ...input.provider,
        name: input.provider.name ?? "dry_run",
        async send(request) {
          providerCalls += 1;
          return input.provider!.send(request);
        },
      }
    : undefined;

  const claimed = await claimCheckinEmailJobs(input.db, {
    limit: input.limit ?? 5,
    staleSeconds: input.staleSeconds ?? 900,
  });

  const result: CheckinEmailDryRunWorkerResult = {
    claimed: claimed.length,
    completed: 0,
    retried: 0,
    failed: 0,
    cancelled: 0,
    providerCalls: 0,
    rows: [],
  };

  for (const row of claimed) {
    const processed = await processClaimedRowDryRun({
      db: input.db,
      row,
      recipientEmail: input.recipientEmail ?? "dry-run@example.com",
      careCheckinConsent: input.careCheckinConsent ?? true,
      careEmailChannelConsent: input.careEmailChannelConsent ?? true,
      provider: countingProvider,
    });
    result.rows.push(processed.summary);
    if (processed.bucket === "completed") result.completed += 1;
    if (processed.bucket === "retried") result.retried += 1;
    if (processed.bucket === "failed") result.failed += 1;
    if (processed.bucket === "cancelled") result.cancelled += 1;
  }

  result.providerCalls = providerCalls;
  return result;
}

async function processClaimedRowDryRun(input: {
  db: CheckinEmailQueueDb;
  row: CheckinEmailQueueRow;
  recipientEmail: string;
  careCheckinConsent: boolean;
  careEmailChannelConsent: boolean;
  provider?: EmailProvider;
}): Promise<{
  bucket: "completed" | "retried" | "failed" | "cancelled";
  summary: {
    id: string;
    status: string;
    outcome: string;
    reasonCode: string;
  };
}> {
  const item = rowToQueueItem(input.row);
  const dry = await processCheckinEmailDryRun({
    item,
    recipientEmail: input.recipientEmail,
    careCheckinConsent: input.careCheckinConsent,
    careEmailChannelConsent: input.careEmailChannelConsent,
    provider: input.provider,
  });

  if (dry.outcome === "dry_run_completed") {
    const updated = await markCheckinEmailSent(input.db, {
      id: input.row.id,
      providerMessageId:
        dry.providerResult && dry.providerResult.ok
          ? dry.providerResult.providerMessageId
          : "dry-run",
    });
    return {
      bucket: "completed",
      summary: {
        id: updated.id,
        status: updated.status,
        outcome: dry.outcome,
        reasonCode: dry.reasonCode,
      },
    };
  }

  if (dry.outcome === "blocked" || dry.outcome === "suppressed") {
    const updated = await markCheckinEmailCancelled(input.db, {
      id: input.row.id,
      reason: dry.reasonCode,
    });
    return {
      bucket: "cancelled",
      summary: {
        id: updated.id,
        status: updated.status,
        outcome: dry.outcome,
        reasonCode: dry.reasonCode,
      },
    };
  }

  const retryable = dry.nextQueueStatus === "retry_scheduled";
  const updated = await markCheckinEmailFailed(input.db, {
    id: input.row.id,
    error: dry.reasonCode,
    retryable,
    retryCount: input.row.retry_count,
  });

  return {
    bucket: updated.status === "pending" ? "retried" : "failed",
    summary: {
      id: updated.id,
      status: updated.status,
      outcome: dry.outcome,
      reasonCode: dry.reasonCode,
    },
  };
}

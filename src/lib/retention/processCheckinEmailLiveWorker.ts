/**
 * Live worker stub — Production blocked; Staging live send still requires separate approval.
 * This module only maps queue rows; it does not enable Production sending.
 */

import {
  claimCheckinEmailJobs,
  markCheckinEmailCancelled,
  markCheckinEmailFailed,
  markCheckinEmailSent,
  rowToQueueItem,
  type CheckinEmailQueueDb,
} from "@/lib/retention/checkinEmailQueuePersistence";
import { processCheckinEmailLive } from "@/lib/retention/processCheckinEmailLive";
import type { EnvLike } from "@/lib/email/provider/emailEnvironment";
import type { EmailProvider } from "@/lib/email/provider/types";

export async function runCheckinEmailQueueLiveWorker(input: {
  db: CheckinEmailQueueDb;
  /** Required for live path; never read from queue rows. */
  resolveRecipientEmail: (rowUserId: string) => Promise<string | null>;
  careCheckinConsent: boolean;
  careEmailChannelConsent: boolean;
  env?: EnvLike;
  provider?: EmailProvider;
  limit?: number;
}): Promise<{ claimed: number; blocked: number; sent: number }> {
  const claimed = await claimCheckinEmailJobs(input.db, {
    limit: input.limit ?? 5,
  });
  let blocked = 0;
  let sent = 0;

  for (const row of claimed) {
    const recipientEmail = await input.resolveRecipientEmail(row.user_id);
    if (!recipientEmail) {
      await markCheckinEmailCancelled(input.db, {
        id: row.id,
        reason: "recipient_unavailable",
      });
      blocked += 1;
      continue;
    }

    const live = await processCheckinEmailLive({
      item: rowToQueueItem(row),
      recipientEmail,
      careCheckinConsent: input.careCheckinConsent,
      careEmailChannelConsent: input.careEmailChannelConsent,
      env: input.env,
      provider: input.provider,
    });

    if (live.outcome === "live_completed") {
      await markCheckinEmailSent(input.db, {
        id: row.id,
        providerMessageId: live.providerResult && live.providerResult.ok ? live.providerResult.providerMessageId : null,
      });
      sent += 1;
      continue;
    }

    if (
      live.outcome === "blocked" ||
      live.outcome === "suppressed" ||
      live.outcome === "duplicate"
    ) {
      await markCheckinEmailCancelled(input.db, {
        id: row.id,
        reason: live.reasonCode,
      });
      blocked += 1;
      continue;
    }

    await markCheckinEmailFailed(input.db, {
      id: row.id,
      error: live.reasonCode,
      retryable: live.nextQueueStatus === "retry_scheduled",
      retryCount: row.retry_count,
    });
  }

  return { claimed: claimed.length, blocked, sent };
}

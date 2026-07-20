/**
 * Process a check-in email queue item through dry-run provider.
 * No DB writes, no network, no provider API keys.
 */

import { buildCheckinEmailSendRequest } from "@/lib/retention/buildCheckinEmailPayload";
import {
  isValidCheckinEmailAddress,
  type CheckinEmailQueueItem,
} from "@/lib/retention/checkinEmailQueuePolicy";
import {
  createEmailProviderFromEnv,
  type DryRunIdempotencyRegistry,
} from "@/lib/email/provider/getEmailProvider";
import type {
  EmailProvider,
  EmailSendResult,
} from "@/lib/email/provider/types";

export type CheckinEmailDryRunOutcome =
  | "dry_run_completed"
  | "blocked"
  | "suppressed"
  | "duplicate"
  | "failed";

export type CheckinEmailDryRunResult = {
  outcome: CheckinEmailDryRunOutcome;
  providerResult: EmailSendResult | null;
  nextQueueStatus:
    | "sent"
    | "suppressed"
    | "failed"
    | "retry_scheduled"
    | "cancelled"
    | null;
  reasonCode: string;
};

export async function processCheckinEmailDryRun(input: {
  item: CheckinEmailQueueItem;
  recipientEmail: string;
  careCheckinConsent: boolean;
  careEmailChannelConsent: boolean;
  marketingConsent?: boolean;
  notificationsEnabled?: boolean;
  provider?: EmailProvider;
  registry?: DryRunIdempotencyRegistry;
}): Promise<CheckinEmailDryRunResult> {
  if (!input.careCheckinConsent) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: "consent_missing",
    };
  }
  if (!input.careEmailChannelConsent) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: input.marketingConsent
        ? "marketing_only_consent"
        : "consent_missing",
    };
  }
  if (input.notificationsEnabled === false) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: "notifications_disabled",
    };
  }
  if (
    input.item.status === "sent" ||
    input.item.status === "cancelled" ||
    input.item.status === "suppressed" ||
    input.item.status === "dead_letter"
  ) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: "already_processed",
    };
  }
  if (!isValidCheckinEmailAddress(input.recipientEmail)) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: "invalid_recipient",
    };
  }

  const built = buildCheckinEmailSendRequest({
    item: input.item,
    recipientEmail: input.recipientEmail,
  });
  if (!built.ok) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: built.errorCode,
    };
  }

  const provider =
    input.provider ??
    createEmailProviderFromEnv(
      { EMAIL_DELIVERY_MODE: "dry_run" },
      { registry: input.registry }
    );

  const providerResult = await provider.send(built.request);

  if (providerResult.ok) {
    return {
      outcome: "dry_run_completed",
      providerResult,
      nextQueueStatus: "sent",
      reasonCode: "dry_run_ok",
    };
  }

  if (providerResult.errorCode === "duplicate_request") {
    return {
      outcome: "duplicate",
      providerResult,
      nextQueueStatus: null,
      reasonCode: "duplicate_request",
    };
  }
  if (providerResult.errorCode === "provider_disabled") {
    return {
      outcome: "suppressed",
      providerResult,
      nextQueueStatus: "suppressed",
      reasonCode: "provider_disabled",
    };
  }
  if (providerResult.errorCode === "live_mode_blocked") {
    return {
      outcome: "blocked",
      providerResult,
      nextQueueStatus: null,
      reasonCode: "live_mode_blocked",
    };
  }
  if (providerResult.retryable) {
    return {
      outcome: "failed",
      providerResult,
      nextQueueStatus: "retry_scheduled",
      reasonCode: providerResult.errorCode,
    };
  }
  return {
    outcome: "failed",
    providerResult,
    nextQueueStatus: "failed",
    reasonCode: providerResult.errorCode,
  };
}

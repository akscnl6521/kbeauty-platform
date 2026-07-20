/**
 * Process a check-in email queue item through live provider gates.
 * Production is always blocked. Staging uses recipient allowlist.
 * No DB writes, no network unless caller injects a live provider.
 */

import { buildCheckinEmailSendRequest } from "@/lib/retention/buildCheckinEmailPayload";
import {
  isValidCheckinEmailAddress,
  type CheckinEmailQueueItem,
} from "@/lib/retention/checkinEmailQueuePolicy";
import {
  isProductionEmailEnvironment,
  type EnvLike,
} from "@/lib/email/provider/emailEnvironment";
import { createEmailProviderFromEnv } from "@/lib/email/provider/getEmailProvider";
import type {
  EmailProvider,
  EmailSendResult,
} from "@/lib/email/provider/types";
import {
  isRecipientAllowlisted,
  parseRecipientAllowlist,
} from "@/lib/email/provider/recipientAllowlist";

export class LiveSendIdempotencyRegistry {
  private seen = new Map<string, string>();

  has(key: string): boolean {
    return this.seen.has(key);
  }

  get(key: string): string | undefined {
    return this.seen.get(key);
  }

  set(key: string, messageId: string): void {
    this.seen.set(key, messageId);
  }

  clear(): void {
    this.seen.clear();
  }
}

export type CheckinEmailLiveOutcome =
  | "live_completed"
  | "blocked"
  | "suppressed"
  | "duplicate"
  | "failed";

export type CheckinEmailLiveResult = {
  outcome: CheckinEmailLiveOutcome;
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

export async function processCheckinEmailLive(input: {
  item: CheckinEmailQueueItem;
  recipientEmail: string;
  careCheckinConsent: boolean;
  careEmailChannelConsent: boolean;
  marketingConsent?: boolean;
  notificationsEnabled?: boolean;
  env?: EnvLike;
  provider?: EmailProvider;
  registry?: LiveSendIdempotencyRegistry;
  allowlist?: Set<string>;
}): Promise<CheckinEmailLiveResult> {
  const env = input.env ?? {};

  if (isProductionEmailEnvironment(env)) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: "production_blocked",
    };
  }

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

  const allowlist =
    input.allowlist ??
    parseRecipientAllowlist(env.EMAIL_STAGING_RECIPIENT_ALLOWLIST);
  if (!isRecipientAllowlisted(input.recipientEmail, allowlist)) {
    return {
      outcome: "blocked",
      providerResult: null,
      nextQueueStatus: null,
      reasonCode: "recipient_not_allowlisted",
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
    input.provider ?? createEmailProviderFromEnv(env, { registry: input.registry });

  const providerResult = await provider.send(built.request);

  if (providerResult.ok) {
    return {
      outcome: "live_completed",
      providerResult,
      nextQueueStatus: "sent",
      reasonCode: "live_ok",
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
  if (
    providerResult.errorCode === "live_mode_blocked" ||
    providerResult.errorCode === "provider_configuration_missing"
  ) {
    return {
      outcome: "blocked",
      providerResult,
      nextQueueStatus: null,
      reasonCode: providerResult.errorCode,
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

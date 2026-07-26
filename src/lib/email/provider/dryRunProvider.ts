/**
 * Dry-run email provider — validates and records, never sends.
 * No network, no SDK, no console dump of full payload/email.
 */

import {
  isValidCheckinEmailAddress,
  maskEmailAddress,
} from "@/lib/retention/checkinEmailQueuePolicy";
import { hasUnsafeCareEmailContent } from "./validateCareEmailBodyUrls";
import type {
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
} from "./types";

export class DryRunIdempotencyRegistry {
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

function dryRunMessageId(idempotencyKey: string): string {
  let h = 0;
  for (let i = 0; i < idempotencyKey.length; i += 1) {
    h = (h * 31 + idempotencyKey.charCodeAt(i)) >>> 0;
  }
  return `dry_run_${h.toString(16)}`;
}

export function createDryRunEmailProvider(options?: {
  registry?: DryRunIdempotencyRegistry;
  simulateTemporaryFailureOnce?: boolean;
}): EmailProvider {
  const registry = options?.registry ?? new DryRunIdempotencyRegistry();
  let temporaryInjected = false;

  return {
    name: "dry_run",
    mode: "dry_run",
    async send(request: EmailSendRequest): Promise<EmailSendResult> {
      const mask = isValidCheckinEmailAddress(request.to)
        ? maskEmailAddress(request.to)
        : null;

      if (!isValidCheckinEmailAddress(request.to)) {
        return {
          ok: false,
          mode: "dry_run",
          errorCode: "invalid_recipient",
          retryable: false,
          recipientMask: mask,
        };
      }
      if (
        !request.subject?.trim() ||
        !request.textBody?.trim() ||
        !request.idempotencyKey?.trim()
      ) {
        return {
          ok: false,
          mode: "dry_run",
          errorCode: "invalid_request",
          retryable: false,
          recipientMask: mask,
        };
      }
      if (hasUnsafeCareEmailContent(request)) {
        return {
          ok: false,
          mode: "dry_run",
          errorCode: "unsafe_payload",
          retryable: false,
          recipientMask: mask,
        };
      }
      if (registry.has(request.idempotencyKey)) {
        return {
          ok: false,
          mode: "dry_run",
          errorCode: "duplicate_request",
          retryable: false,
          recipientMask: mask,
          detail: "already_processed",
        };
      }
      if (options?.simulateTemporaryFailureOnce && !temporaryInjected) {
        temporaryInjected = true;
        return {
          ok: false,
          mode: "dry_run",
          errorCode: "temporary_provider_error",
          retryable: true,
          recipientMask: mask,
        };
      }

      const providerMessageId = dryRunMessageId(request.idempotencyKey);
      registry.set(request.idempotencyKey, providerMessageId);
      return {
        ok: true,
        mode: "dry_run",
        providerMessageId,
        idempotencyKey: request.idempotencyKey,
        recipientMask: mask!,
      };
    },
  };
}

/**
 * Resolve email delivery mode and provider from env-like maps.
 * Pure helpers are testable. Do not import from client components.
 */

import { createDisabledEmailProvider } from "./disabledProvider";
import {
  createDryRunEmailProvider,
  DryRunIdempotencyRegistry,
} from "./dryRunProvider";
import type {
  EmailDeliveryMode,
  EmailProvider,
  EmailProviderName,
  EmailSendRequest,
  EmailSendResult,
} from "./types";

export type EnvLike = Record<string, string | undefined>;

export function resolveEmailDeliveryMode(env: EnvLike): EmailDeliveryMode {
  const mode = (env.EMAIL_DELIVERY_MODE || "").trim().toLowerCase();
  if (mode === "disabled" || mode === "dry_run" || mode === "live") {
    return mode;
  }
  const provider = (env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (provider === "dry_run") return "dry_run";
  return "disabled";
}

export function resolveEmailProviderName(env: EnvLike): EmailProviderName {
  const name = (env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (
    name === "none" ||
    name === "dry_run" ||
    name === "resend" ||
    name === "sendgrid" ||
    name === "ses"
  ) {
    return name;
  }
  return "none";
}

function createLiveBlockedProvider(): EmailProvider {
  return {
    name: "live_blocked",
    mode: "live",
    async send(_request: EmailSendRequest): Promise<EmailSendResult> {
      return {
        ok: false,
        mode: "live",
        errorCode: "live_mode_blocked",
        retryable: false,
        recipientMask: null,
        detail: "live_mode_not_implemented",
      };
    },
  };
}

export function createEmailProviderFromEnv(
  env: EnvLike,
  options?: { registry?: DryRunIdempotencyRegistry }
): EmailProvider {
  const mode = resolveEmailDeliveryMode(env);
  if (mode === "dry_run") {
    return createDryRunEmailProvider({ registry: options?.registry });
  }
  if (mode === "live") {
    return createLiveBlockedProvider();
  }
  return createDisabledEmailProvider();
}

/** Server entry — reads process.env once. Never logs env values. */
export function getEmailProvider(options?: {
  registry?: DryRunIdempotencyRegistry;
}): EmailProvider {
  return createEmailProviderFromEnv(process.env, options);
}

export {
  createDisabledEmailProvider,
  createDryRunEmailProvider,
  DryRunIdempotencyRegistry,
};

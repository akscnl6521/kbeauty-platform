/**
 * Resolve email delivery mode and provider from env-like maps.
 * Pure helpers are testable. Do not import from client components.
 */

import { validateEmailFromAddress } from "./emailFromAddress";
import { evaluateEmailLiveProviderGate } from "./emailLiveGate";
import { createDisabledEmailProvider } from "./disabledProvider";
import {
  createDryRunEmailProvider,
  DryRunIdempotencyRegistry,
} from "./dryRunProvider";
import {
  createResendEmailProvider,
  type ResendIdempotencyRegistry,
  type ResendTransport,
} from "./resendProvider";
import type {
  EmailDeliveryMode,
  EmailProvider,
  EmailProviderErrorCode,
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

function createGateBlockedProvider(
  errorCode: EmailProviderErrorCode,
  detail?: string
): EmailProvider {
  return {
    name: "live_blocked",
    mode: "live",
    async send(_request: EmailSendRequest): Promise<EmailSendResult> {
      return {
        ok: false,
        mode: "live",
        errorCode,
        retryable: false,
        recipientMask: null,
        detail,
      };
    },
  };
}

export function createEmailProviderFromEnv(
  env: EnvLike,
  options?: {
    registry?: DryRunIdempotencyRegistry | ResendIdempotencyRegistry;
    resendTransport?: ResendTransport;
  }
): EmailProvider {
  const mode = resolveEmailDeliveryMode(env);
  if (mode === "dry_run") {
    return createDryRunEmailProvider({
      registry: options?.registry as DryRunIdempotencyRegistry | undefined,
    });
  }
  if (mode === "live") {
    const gate = evaluateEmailLiveProviderGate(env);
    if (!gate.ok) {
      return createGateBlockedProvider(gate.errorCode, gate.detail);
    }

    const fromResult = validateEmailFromAddress(env.EMAIL_FROM_ADDRESS);
    if (!fromResult.ok) {
      return createGateBlockedProvider(
        "provider_configuration_missing",
        fromResult.reason
      );
    }

    return createResendEmailProvider({
      apiKey: (env.RESEND_API_KEY ?? "").trim(),
      fromAddress: fromResult.value,
      transport: options?.resendTransport,
      registry: options?.registry as ResendIdempotencyRegistry | undefined,
    });
  }
  return createDisabledEmailProvider();
}

/** Server entry — reads process.env once. Never logs env values. */
export function getEmailProvider(options?: {
  registry?: DryRunIdempotencyRegistry | ResendIdempotencyRegistry;
  resendTransport?: ResendTransport;
}): EmailProvider {
  return createEmailProviderFromEnv(process.env, options);
}

export {
  createDisabledEmailProvider,
  createDryRunEmailProvider,
  DryRunIdempotencyRegistry,
  createResendEmailProvider,
};
export {
  evaluateEmailLiveProviderGate,
  isEmailLiveKillSwitchEnabled,
} from "./emailLiveGate";
export {
  isProductionEmailEnvironment,
  resolveEmailRuntimeEnvironment,
} from "./emailEnvironment";
export { validateEmailFromAddress } from "./emailFromAddress";
export {
  isRecipientAllowlisted,
  parseRecipientAllowlist,
} from "./recipientAllowlist";
export { normalizeResendError } from "./normalizeResendError";

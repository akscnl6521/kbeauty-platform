/**
 * Safety gates before constructing a live Resend provider.
 */

import { validateEmailFromAddress } from "./emailFromAddress";
import { isProductionEmailEnvironment, type EnvLike } from "./emailEnvironment";
import type { EmailDeliveryMode, EmailProviderErrorCode, EmailProviderName } from "./types";

export type EmailLiveGateResult =
  | { ok: true }
  | { ok: false; errorCode: EmailProviderErrorCode; detail?: string };

export function isEmailLiveKillSwitchEnabled(env: EnvLike): boolean {
  return (env.EMAIL_LIVE_KILL_SWITCH ?? "").trim().toLowerCase() === "true";
}

function resolveEmailDeliveryMode(env: EnvLike): EmailDeliveryMode {
  const mode = (env.EMAIL_DELIVERY_MODE || "").trim().toLowerCase();
  if (mode === "disabled" || mode === "dry_run" || mode === "live") {
    return mode;
  }
  const provider = (env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (provider === "dry_run") return "dry_run";
  return "disabled";
}

function resolveEmailProviderName(env: EnvLike): EmailProviderName {
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

export function evaluateEmailLiveProviderGate(env: EnvLike): EmailLiveGateResult {
  const mode = resolveEmailDeliveryMode(env);
  if (mode !== "live") {
    return { ok: false, errorCode: "live_mode_blocked", detail: "mode_not_live" };
  }

  const provider = resolveEmailProviderName(env);
  if (provider !== "resend") {
    return {
      ok: false,
      errorCode: "live_mode_blocked",
      detail: "provider_not_resend",
    };
  }

  if (isProductionEmailEnvironment(env)) {
    return {
      ok: false,
      errorCode: "live_mode_blocked",
      detail: "production_blocked",
    };
  }

  if (!isEmailLiveKillSwitchEnabled(env)) {
    return {
      ok: false,
      errorCode: "live_mode_blocked",
      detail: "kill_switch_disabled",
    };
  }

  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      ok: false,
      errorCode: "provider_configuration_missing",
      detail: "missing_resend_api_key",
    };
  }

  const fromResult = validateEmailFromAddress(env.EMAIL_FROM_ADDRESS);
  if (!fromResult.ok) {
    return {
      ok: false,
      errorCode: "provider_configuration_missing",
      detail: fromResult.reason,
    };
  }

  return { ok: true };
}

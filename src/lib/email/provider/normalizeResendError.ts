/**
 * Map Resend/provider errors to provider-neutral codes.
 * Never expose full provider responses in detail strings.
 */

import type { EmailProviderErrorCode } from "./types";

export type NormalizedResendError = {
  errorCode: EmailProviderErrorCode;
  retryable: boolean;
  detail?: string;
};

function collectMessage(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      record.message,
      record.name,
      record.statusCode,
      record.code,
    ]
      .filter((part) => part != null)
      .map(String);
    return parts.join(" ");
  }
  return String(error);
}

export function normalizeResendError(error: unknown): NormalizedResendError {
  const message = collectMessage(error).toLowerCase();

  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("rate_limit") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("fetch failed")
  ) {
    return {
      errorCode: "temporary_provider_error",
      retryable: true,
      detail: "temporary_provider_error",
    };
  }

  if (
    message.includes("invalid recipient") ||
    message.includes("invalid email") ||
    message.includes("recipient")
  ) {
    return {
      errorCode: "invalid_recipient",
      retryable: false,
      detail: "invalid_recipient",
    };
  }

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("api key") ||
    message.includes("api_key") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("authentication")
  ) {
    return {
      errorCode: "provider_configuration_missing",
      retryable: false,
      detail: "provider_configuration_missing",
    };
  }

  if (
    message.includes("from") ||
    message.includes("domain") ||
    message.includes("sender")
  ) {
    return {
      errorCode: "provider_configuration_missing",
      retryable: false,
      detail: "provider_configuration_missing",
    };
  }

  if (
    message.includes("reject") ||
    message.includes("rejected") ||
    message.includes("blocked")
  ) {
    return {
      errorCode: "permanent_provider_error",
      retryable: false,
      detail: "permanent_provider_error",
    };
  }

  return {
    errorCode: "temporary_provider_error",
    retryable: true,
    detail: "temporary_provider_error",
  };
}

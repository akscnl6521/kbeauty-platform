/**
 * Secret-safe helpers for DATA_GO_KR_SERVICE_KEY.
 * Never print, persist, or return the raw key or authenticated URLs.
 */

import { createHash } from "node:crypto";
import type { PublicDataErrorCode, SanitizedPublicDataError } from "./types";

export const DATA_GO_KR_SERVICE_KEY_ENV = "DATA_GO_KR_SERVICE_KEY" as const;

export function readDataGoKrServiceKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env[DATA_GO_KR_SERVICE_KEY_ENV];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Short non-reversible fingerprint for diagnostics (never the key). */
export function serviceKeyFingerprint(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex").slice(0, 12);
}

export function redactSecrets(text: string, knownSecrets: string[] = []): string {
  let out = String(text ?? "");
  for (const secret of knownSecrets) {
    if (!secret || secret.length < 8) continue;
    out = out.split(secret).join("[REDACTED]");
    try {
      const encoded = encodeURIComponent(secret);
      if (encoded !== secret) {
        out = out.split(encoded).join("[REDACTED]");
      }
    } catch {
      // ignore encode failures
    }
  }
  out = out.replace(
    /(?:ServiceKey|serviceKey|service_key|DATA_GO_KR_SERVICE_KEY)=([^&\s"'`]+)/gi,
    "ServiceKey=[REDACTED]",
  );
  // Long hex blobs that look like decoded keys
  out = out.replace(/\b[a-f0-9]{40,}\b/gi, "[REDACTED]");
  return out;
}

/** Host + pathname only — strips query/hash that may contain secrets. */
export function toSafeEndpoint(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return redactSecrets(url.split("?")[0] ?? "invalid-url");
  }
}

export function sanitizeErrorMessage(
  message: string,
  knownSecrets: string[] = [],
): string {
  return redactSecrets(String(message ?? ""), knownSecrets).slice(0, 400);
}

export function buildSanitizedError(
  code: PublicDataErrorCode,
  messageKo: string,
  opts?: {
    httpStatus?: number | null;
    retryable?: boolean;
    knownSecrets?: string[];
  },
): SanitizedPublicDataError {
  return {
    code,
    messageKo: sanitizeErrorMessage(messageKo, opts?.knownSecrets ?? []),
    httpStatus: opts?.httpStatus ?? null,
    retryable: opts?.retryable ?? false,
    databaseTouched: false,
  };
}

export function assertNoSecretLeak(
  text: string,
  knownSecrets: string[],
): void {
  for (const secret of knownSecrets) {
    if (secret && secret.length >= 8 && text.includes(secret)) {
      throw new Error("secret_leak_detected");
    }
  }
  if (/(?:ServiceKey|serviceKey)=(?!\[REDACTED\])[^&\s"'`]+/i.test(text)) {
    throw new Error("service_key_param_leak_detected");
  }
}

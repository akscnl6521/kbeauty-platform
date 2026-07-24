/**
 * Deterministic retry / exponential backoff plans (P3-T03).
 * No network · no sleeps — returns schedule metadata only.
 */

import {
  RETRY_BASE_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_MAX_MS,
} from "./constants";
import type { RetryBackoffPlan } from "./types";

/**
 * Exponential backoff without jitter for deterministic tests.
 * delay = min(maxMs, baseMs * 2^(attempt-1))
 */
export function computeBackoffDelayMs(
  attempt: number,
  baseMs: number = RETRY_BASE_MS,
  maxMs: number = RETRY_MAX_MS,
): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1));
}

export function buildRetryBackoffPlan(input: {
  failureCount: number;
  now?: Date;
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  retryable?: boolean;
}): RetryBackoffPlan {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? RETRY_MAX_ATTEMPTS;
  const failureCount = Math.max(0, Math.floor(input.failureCount));
  const attempt = failureCount + 1;
  const retryable = input.retryable !== false;
  const exhausted = !retryable || failureCount >= maxAttempts;

  if (exhausted) {
    return {
      attempt,
      failureCount,
      delayMs: 0,
      nextRetryAt: now.toISOString(),
      retryable: false,
      exhausted: true,
      reason: retryable ? "max_attempts_exhausted" : "not_retryable",
    };
  }

  const delayMs = computeBackoffDelayMs(
    attempt,
    input.baseMs ?? RETRY_BASE_MS,
    input.maxMs ?? RETRY_MAX_MS,
  );

  return {
    attempt,
    failureCount,
    delayMs,
    nextRetryAt: new Date(now.getTime() + delayMs).toISOString(),
    retryable: true,
    exhausted: false,
    reason: "scheduled_retry",
  };
}

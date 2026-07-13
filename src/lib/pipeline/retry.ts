import "server-only";

import type { PipelineJob, PipelineJobStatus } from "@/lib/pipeline/types";

const RETRYABLE = new Set([
  "FETCH_TIMEOUT",
  "FETCH_FAILED",
  "DNS_ERROR",
  "HTTP_429",
  "HTTP_5XX",
  "PARSE_FAILED",
]);

const NON_RETRYABLE = new Set([
  "UNSAFE_URL",
  "INVALID_URL",
  "HTTP_403",
  "ROBOTS_DISALLOWED",
  "LOGIN_REQUIRED",
  "CAPTCHA",
  "UNSUPPORTED_STRUCTURE",
  "PRODUCT_INFO_INCOMPLETE",
]);

export function isRetryableFailure(code: string | null | undefined): boolean {
  if (!code) return false;
  if (NON_RETRYABLE.has(code)) return false;
  return RETRYABLE.has(code);
}

export function computeNextRetryAt(
  attempts: number,
  baseMs = 5_000,
  maxMs = 15 * 60_000
): string {
  const delay = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * 500);
  return new Date(Date.now() + delay + jitter).toISOString();
}

export function applyJobFailure(
  job: PipelineJob,
  code: string,
  message: string
): PipelineJob {
  // attempts already incremented by claimNextJobs
  const attempts = job.attempts;
  if (isRetryableFailure(code) && attempts < job.maxAttempts) {
    return {
      ...job,
      attempts,
      status: "retry_wait",
      failureCode: code,
      safeFailureMessage: message,
      nextRetryAt: computeNextRetryAt(attempts),
      completedAt: null,
      claimedBy: null,
      claimHeartbeatAt: null,
    };
  }

  const status: PipelineJobStatus =
    code === "NEEDS_REVIEW" ? "needs_review" : "failed";

  return {
    ...job,
    attempts,
    status,
    failureCode: code,
    safeFailureMessage: message,
    nextRetryAt: null,
    completedAt: new Date().toISOString(),
    claimedBy: null,
    claimHeartbeatAt: null,
  };
}

export function canRunJobNow(job: PipelineJob, now = Date.now()): boolean {
  if (job.status === "queued" || job.status === "running") return true;
  if (job.status !== "retry_wait" || !job.nextRetryAt) return false;
  return new Date(job.nextRetryAt).getTime() <= now;
}

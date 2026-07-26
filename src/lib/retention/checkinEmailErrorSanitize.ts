/**
 * Sanitize provider / worker errors before storing in last_error.
 * Never persist recipient emails or raw provider dumps.
 */

const EMAIL_LIKE =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const FORBIDDEN_FRAGMENTS = [
  "recipient_email",
  "authorization",
  "api_key",
  "apikey",
  "bearer ",
  "password",
];

export const CHECKIN_EMAIL_MAX_RETRY_ATTEMPTS = 3;

export function sanitizeCheckinEmailError(
  raw: string | null | undefined,
  fallback = "provider_error"
): string {
  if (typeof raw !== "string" || !raw.trim()) {
    return fallback;
  }

  let text = raw.replace(EMAIL_LIKE, "[redacted-email]");
  const lower = text.toLowerCase();
  for (const frag of FORBIDDEN_FRAGMENTS) {
    if (lower.includes(frag)) {
      return fallback;
    }
  }

  // Collapse whitespace and cap length (no full provider dumps).
  text = text.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!text) return fallback;
  return text;
}

export function nextRetryAtIso(
  retryCountAfterIncrement: number,
  now: Date = new Date()
): string | null {
  // Align with policy delays: 5m, 30m, 2h for attempts 1..3
  const delaysMs = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;
  const idx = retryCountAfterIncrement - 1;
  if (idx < 0 || idx >= delaysMs.length) return null;
  return new Date(now.getTime() + delaysMs[idx]).toISOString();
}

/**
 * Staging-only recipient allowlist for live email sends.
 */

import { isValidCheckinEmailAddress } from "@/lib/retention/checkinEmailQueuePolicy";

export function parseRecipientAllowlist(raw: string | undefined | null): Set<string> {
  const allowlist = new Set<string>();
  if (typeof raw !== "string" || !raw.trim()) {
    return allowlist;
  }

  for (const part of raw.split(",")) {
    const candidate = part.trim().toLowerCase();
    if (!candidate) continue;
    if (candidate === "*") continue;
    if (candidate.startsWith("@")) continue;
    if (!isValidCheckinEmailAddress(candidate)) continue;
    allowlist.add(candidate);
  }

  return allowlist;
}

export function isRecipientAllowlisted(
  email: string,
  allowlist: Set<string>
): boolean {
  if (allowlist.size === 0) return false;
  if (!isValidCheckinEmailAddress(email)) return false;
  return allowlist.has(email.trim().toLowerCase());
}

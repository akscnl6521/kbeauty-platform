/**
 * Validate EMAIL_FROM_ADDRESS for live Resend sends.
 */

import { isValidCheckinEmailAddress } from "@/lib/retention/checkinEmailQueuePolicy";

const CONTROL_OR_NEWLINE_RE = /[\0-\x1f\x7f\r\n]/;
const DISPLAY_NAME_RE = /^(.+?)\s*<([^>]+)>$/;

export type EmailFromAddressValidation =
  | { ok: true; value: string }
  | { ok: false; reason: string };

function hasMultipleAddresses(raw: string): boolean {
  if (raw.includes(",")) return true;
  const atCount = (raw.match(/@/g) ?? []).length;
  return atCount > 1;
}

function extractEmailPart(raw: string): string | null {
  const trimmed = raw.trim();
  const displayMatch = DISPLAY_NAME_RE.exec(trimmed);
  if (displayMatch) {
    return displayMatch[2]?.trim() ?? null;
  }
  return trimmed;
}

export function validateEmailFromAddress(
  raw: string | undefined | null
): EmailFromAddressValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "missing_from_address" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "missing_from_address" };
  }
  if (CONTROL_OR_NEWLINE_RE.test(trimmed)) {
    return { ok: false, reason: "control_characters" };
  }
  if (hasMultipleAddresses(trimmed)) {
    return { ok: false, reason: "multiple_addresses" };
  }

  const emailPart = extractEmailPart(trimmed);
  if (!emailPart || !isValidCheckinEmailAddress(emailPart)) {
    return { ok: false, reason: "invalid_email" };
  }

  return { ok: true, value: trimmed };
}

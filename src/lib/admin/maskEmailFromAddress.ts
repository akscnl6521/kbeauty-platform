/**
 * Mask a from address for admin display (domain only).
 */

const DISPLAY_NAME_RE = /^(.+?)\s*<([^>]+)>$/;

function extractEmailPart(raw: string): string {
  const trimmed = raw.trim();
  const displayMatch = DISPLAY_NAME_RE.exec(trimmed);
  if (displayMatch) {
    return displayMatch[2]?.trim() ?? trimmed;
  }
  return trimmed;
}

export function maskFromAddressForDisplay(from: string): string {
  const email = extractEmailPart(from);
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    return "***@[invalid]";
  }
  const domain = email.slice(at + 1);
  return `***@${domain}`;
}

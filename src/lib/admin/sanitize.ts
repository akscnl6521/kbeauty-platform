import "server-only";

/**
 * Plain-text sanitization for admin write inputs (no HTML/script).
 */

export function stripControlAndHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOptionalText(
  value: unknown,
  maxLen: number
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const cleaned = stripControlAndHtml(value);
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

export function requireText(
  value: unknown,
  field: string,
  maxLen: number
): string {
  if (typeof value !== "string") {
    throw Object.assign(new Error(`${field} required`), { field });
  }
  const cleaned = stripControlAndHtml(value);
  if (!cleaned) {
    throw Object.assign(new Error(`${field} required`), { field });
  }
  if (cleaned.length > maxLen) {
    throw Object.assign(new Error(`${field} too long`), { field });
  }
  return cleaned;
}

export function isSafeHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

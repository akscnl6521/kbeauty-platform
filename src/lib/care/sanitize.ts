/**
 * Pure memo sanitization (client + server safe).
 */

export function sanitizeMemo(
  text: string | null | undefined,
  maxLen = 500
): string | null {
  if (!text) return null;
  const stripped = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (!stripped) return null;
  return stripped.slice(0, maxLen);
}

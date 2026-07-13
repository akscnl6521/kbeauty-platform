const DEFAULT_PREFIXES = [
  "/my",
  "/onboarding",
  "/results",
  "/analyze",
  "/routine",
  "/auth/link-local",
];

/** Open redirect를 막고 고객 영역의 내부 경로만 반환한다. */
export function sanitizeNextPath(raw: string | null | undefined, fallback = "/my"): string {
  if (!raw || raw.length > 2048) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  const normalized = decoded.trim().toLowerCase();
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    normalized.startsWith("javascript:") ||
    normalized.startsWith("data:") ||
    decoded.includes("://") ||
    decoded.includes("\\") ||
    /[\u0000-\u001f]/.test(decoded)
  ) {
    return fallback;
  }
  return decoded;
}

export function sanitizeCustomerNextPath(raw: string | null | undefined, fallback = "/my"): string {
  const path = sanitizeNextPath(raw, fallback);
  const pathOnly = path.split("?")[0] ?? path;
  return DEFAULT_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)
  )
    ? path
    : fallback;
}

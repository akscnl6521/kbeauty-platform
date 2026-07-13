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
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}

export function sanitizeCustomerNextPath(raw: string | null | undefined, fallback = "/my"): string {
  const path = sanitizeNextPath(raw, fallback);
  return DEFAULT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    ? path
    : fallback;
}

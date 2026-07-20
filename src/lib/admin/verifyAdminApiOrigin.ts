/**
 * Verify Origin or Referer matches the request Host (same-origin admin API guard).
 * No Origin and no Referer => false.
 */

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "");
}

function hostFromUrl(url: string): string | null {
  try {
    return normalizeHost(new URL(url).host);
  } catch {
    return null;
  }
}

export function verifyAdminApiOrigin(headers: {
  origin?: string | null;
  referer?: string | null;
  host?: string | null;
}): boolean {
  const host = normalizeHost(headers.host ?? "");
  if (!host) return false;

  const origin = (headers.origin ?? "").trim();
  const referer = (headers.referer ?? "").trim();
  if (!origin && !referer) return false;

  if (origin) {
    const originHost = hostFromUrl(origin);
    if (originHost && originHost === host) return true;
  }

  if (referer) {
    const refererHost = hostFromUrl(referer);
    if (refererHost && refererHost === host) return true;
  }

  return false;
}

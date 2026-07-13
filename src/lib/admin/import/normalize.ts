import "server-only";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_id",
]);

/**
 * Normalize product/URL strings for duplicate comparison.
 */
export function normalizeTextKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-·•|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeNameBrandKey(
  name: string | null | undefined,
  brand: string | null | undefined
): string {
  return `${normalizeTextKey(name)}||${normalizeTextKey(brand)}`;
}

/**
 * Canonicalize product page URL for storage/dedup.
 */
export function canonicalizeProductUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;

    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);

    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        params.delete(key);
      }
    }

    let pathname = url.pathname || "/";
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    const query = params.toString();
    return query
      ? `https://${host}${pathname}?${query}`
      : `https://${host}${pathname}`;
  } catch {
    return null;
  }
}

export function extractDomain(raw: string): string | null {
  try {
    let host = new URL(raw).hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}

export function guessCountryFromUrl(raw: string): string | null {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host.endsWith(".co.kr") || host.endsWith(".kr")) return "KR";
    if (host.endsWith(".co.jp") || host.endsWith(".jp")) return "JP";
    if (host.endsWith(".com.au") || host.endsWith(".au")) return "AU";
    if (host.endsWith(".co.uk") || host.endsWith(".uk")) return "GB";
    return null;
  } catch {
    return null;
  }
}

export function guessSourceTypeFromUrl(raw: string): string {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    const retailHints = [
      "oliveyoung",
      "sephora",
      "ulta",
      "amazon",
      "coupang",
      "ssg",
      "yes24",
      "iherb",
      "stylevana",
      "yesstyle",
      "jolse",
      "sokoglam",
    ];
    if (retailHints.some((h) => host.includes(h))) return "official_retailer";
    return "search_result";
  } catch {
    return "other";
  }
}

/**
 * Parse multiline URL paste: trim, drop blanks, dedupe (order preserved).
 */
export function parseUrlListInput(raw: string, max = 50): {
  urls: string[];
  truncated: boolean;
} {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const line of lines) {
    const key = canonicalizeProductUrl(line) ?? line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(line);
    if (urls.length >= max) {
      return { urls, truncated: lines.length > urls.length || seen.size > max };
    }
  }
  return { urls, truncated: false };
}

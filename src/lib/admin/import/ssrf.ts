import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-safe HTTPS URL validation with DNS private-IP recheck.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
]);

export type UrlSafetyResult =
  | { ok: true; url: URL; normalizedHref: string }
  | { ok: false; code: "INVALID_URL" | "UNSAFE_URL"; message: string };

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice("::ffff:".length);
    return isPrivateIpv4(v4);
  }
  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

/**
 * Parse and validate URL shape (no DNS yet).
 */
export function assertPublicHttpsUrlShape(raw: string): UrlSafetyResult {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed || trimmed.length > 2000) {
    return { ok: false, code: "INVALID_URL", message: "URL이 올바르지 않습니다." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: "INVALID_URL", message: "URL 형식이 올바르지 않습니다." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, code: "UNSAFE_URL", message: "https URL만 허용됩니다." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, code: "UNSAFE_URL", message: "허용되지 않은 호스트입니다." };
  }
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, code: "UNSAFE_URL", message: "허용되지 않은 호스트입니다." };
  }

  if (isIP(host) && isBlockedIpAddress(host)) {
    return { ok: false, code: "UNSAFE_URL", message: "사설/로컬 주소는 허용되지 않습니다." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, code: "UNSAFE_URL", message: "인증 정보가 포함된 URL은 허용되지 않습니다." };
  }

  return { ok: true, url: parsed, normalizedHref: parsed.href };
}

/**
 * Resolve hostname and reject private IPs. Call before and after redirects.
 */
export async function assertResolvedPublicHost(hostname: string): Promise<UrlSafetyResult> {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, code: "UNSAFE_URL", message: "허용되지 않은 호스트입니다." };
  }

  if (isIP(host)) {
    if (isBlockedIpAddress(host)) {
      return { ok: false, code: "UNSAFE_URL", message: "사설/로컬 주소는 허용되지 않습니다." };
    }
    return {
      ok: true,
      url: new URL(`https://${host}/`),
      normalizedHref: `https://${host}/`,
    };
  }

  try {
    const results = await lookup(host, { all: true, verbatim: true });
    if (!results.length) {
      return { ok: false, code: "UNSAFE_URL", message: "호스트를 확인할 수 없습니다." };
    }
    for (const row of results) {
      if (isBlockedIpAddress(row.address)) {
        return {
          ok: false,
          code: "UNSAFE_URL",
          message: "사설/로컬 주소는 허용되지 않습니다.",
        };
      }
    }
  } catch {
    return { ok: false, code: "UNSAFE_URL", message: "호스트를 확인할 수 없습니다." };
  }

  return {
    ok: true,
    url: new URL(`https://${host}/`),
    normalizedHref: `https://${host}/`,
  };
}

export async function assertSafePublicHttpsUrl(
  raw: string
): Promise<UrlSafetyResult> {
  const shape = assertPublicHttpsUrlShape(raw);
  if (!shape.ok) return shape;
  const resolved = await assertResolvedPublicHost(shape.url.hostname);
  if (!resolved.ok) return resolved;
  return shape;
}

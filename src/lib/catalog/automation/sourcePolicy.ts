/**
 * SSRF / source policy helpers for catalog automation (pure, no server-only).
 */

import { isLikelySearchOrCategoryUrl } from "./validators";
import type { CatalogSourceRecord, SourcePermissionResult } from "./types";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
]);

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
  return false;
}

export function assertCatalogFetchUrl(raw: string): {
  ok: boolean;
  code?: string;
  message?: string;
} {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return { ok: false, code: "INVALID_URL", message: "empty" };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: "INVALID_URL", message: "invalid" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, code: "UNSAFE_URL", message: "https only" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: "UNSAFE_URL", message: "credentials blocked" };
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    return { ok: false, code: "UNSAFE_URL", message: "blocked host" };
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIpv4(host)) {
    return { ok: false, code: "UNSAFE_URL", message: "private ip" };
  }
  if (isLikelySearchOrCategoryUrl(parsed.href)) {
    return {
      ok: false,
      code: "SEARCH_OR_CATEGORY_URL",
      message: "Search/category URLs cannot be purchase or product sources",
    };
  }
  return { ok: true };
}

export function evaluateSourceFetchGate(
  source: CatalogSourceRecord
): SourcePermissionResult {
  if (source.authorizationStatus === "prohibited") {
    return {
      ok: false,
      status: "prohibited",
      reason: "prohibited",
      nextAction: "Do not fetch",
    };
  }
  if (
    source.authorizationStatus === "api_credentials_required" ||
    !source.automationAllowed
  ) {
    return {
      ok: false,
      status: "authorization_required",
      reason: "authorization_required",
      nextAction: "Obtain approval",
    };
  }
  if (source.robotsStatus === "disallow") {
    return {
      ok: false,
      status: "robots_disallow",
      reason: "robots disallow",
      nextAction: "Use API/feed",
    };
  }
  return { ok: true, status: "allowed" };
}

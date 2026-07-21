/**
 * Shared care-email URL validation for provider send paths.
 * Allows only the two absolute URLs derived from verified metadata paths.
 */

import { buildAbsoluteCareEmailUrl } from "@/lib/retention/buildCheckinEmailPayload";
import type { EmailSendRequest } from "./types";

const HTTPS_URL_RE = /https:\/\/[^\s)\]>]+/gi;
const HTTP_URL_RE = /\bhttp:\/\/[^\s)\]>]+/gi;

export function resolveAllowedCareEmailUrls(
  metadata: EmailSendRequest["metadata"]
): { ok: true; checkinUrl: string; settingsUrl: string } | { ok: false } {
  const checkinUrl = buildAbsoluteCareEmailUrl(metadata.checkinUrlPath);
  const settingsUrl = buildAbsoluteCareEmailUrl(metadata.preferenceUrlPath);
  if (!checkinUrl || !settingsUrl) {
    return { ok: false };
  }
  return { ok: true, checkinUrl, settingsUrl };
}

function careUrlsMatch(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return (
      a.protocol === "https:" &&
      b.protocol === "https:" &&
      a.origin === b.origin &&
      a.pathname === b.pathname &&
      !a.search &&
      !b.search &&
      !a.hash &&
      !b.hash &&
      !a.username &&
      !b.username &&
      !a.password &&
      !b.password
    );
  } catch {
    return false;
  }
}

function isAllowedCareUrlShape(url: string, allowedOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.origin !== allowedOrigin) return false;
    if (parsed.search || parsed.hash || parsed.username || parsed.password) {
      return false;
    }
    return (
      /^\/my\/check-ins\/[A-Za-z0-9_-]+$/.test(parsed.pathname) ||
      parsed.pathname === "/my/settings"
    );
  } catch {
    return false;
  }
}

export function extractHttpsUrlsFromText(text: string): string[] {
  return text.match(HTTPS_URL_RE) ?? [];
}

export function hasOnlyAllowedCareEmailBodyUrls(
  request: EmailSendRequest
): boolean {
  if (HTTP_URL_RE.test(request.textBody)) {
    return false;
  }

  const allowed = resolveAllowedCareEmailUrls(request.metadata);
  if (!allowed.ok) {
    return false;
  }

  const allowedOrigin = new URL(allowed.checkinUrl).origin;
  const allowedUrls = [allowed.checkinUrl, allowed.settingsUrl];
  const bodyUrls = extractHttpsUrlsFromText(request.textBody);

  for (const bodyUrl of bodyUrls) {
    if (!isAllowedCareUrlShape(bodyUrl, allowedOrigin)) {
      return false;
    }
    const matched = allowedUrls.some((allowedUrl) =>
      careUrlsMatch(bodyUrl, allowedUrl)
    );
    if (!matched) {
      return false;
    }
  }

  return true;
}

export const CARE_EMAIL_UNSAFE_RE =
  /photo|acute|diagnos|affiliate|sponsored|javascript:|data:/i;

export function hasUnsafeCareEmailContent(request: EmailSendRequest): boolean {
  if (/[\r\n]/.test(request.subject)) {
    return true;
  }
  const blob = [
    request.subject,
    request.textBody,
    JSON.stringify(request.metadata),
  ].join("\n");
  if (CARE_EMAIL_UNSAFE_RE.test(blob)) {
    return true;
  }
  return !hasOnlyAllowedCareEmailBodyUrls(request);
}

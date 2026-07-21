/**
 * Resolve HTTPS site origin for care email absolute links.
 * Preview deployments must not use production SITE_URL.
 */

export type CareEmailSiteOriginEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

function readDefaultEnv(): CareEmailSiteOriginEnv {
  return {
    VERCEL_ENV: process.env.VERCEL_ENV,
    SITE_URL: process.env.SITE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
  };
}

function normEnv(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

export function isVercelPreviewHostname(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".vercel.app");
}

function normalizeSiteOrigin(candidate: string | undefined): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:") return null;
    if (isBlockedHostname(url.hostname)) return null;
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function firstValidOrigin(
  candidates: Array<string | undefined>,
  options?: { rejectVercelPreview?: boolean }
): string | null {
  for (const candidate of candidates) {
    const origin = normalizeSiteOrigin(candidate);
    if (!origin) continue;
    if (options?.rejectVercelPreview) {
      try {
        if (isVercelPreviewHostname(new URL(origin).hostname)) continue;
      } catch {
        continue;
      }
    }
    return origin;
  }
  return null;
}

export function resolveCareEmailSiteOrigin(
  env: CareEmailSiteOriginEnv = readDefaultEnv()
): string | null {
  const vercelEnv = normEnv(env.VERCEL_ENV);

  if (vercelEnv === "preview") {
    return firstValidOrigin([env.VERCEL_URL, env.VERCEL_BRANCH_URL]);
  }

  if (vercelEnv === "production") {
    return firstValidOrigin([env.SITE_URL, env.NEXT_PUBLIC_SITE_URL], {
      rejectVercelPreview: true,
    });
  }

  return firstValidOrigin([
    env.SITE_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
  ]);
}
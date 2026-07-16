import "server-only";

/**
 * Shared admin list/detail query helpers (server-only).
 * No secrets. SELECT helpers only live in feature modules.
 */

export function parsePositiveInt(
  value: number | string | null | undefined,
  fallback: number,
  max?: number
): number {
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  const floored = Math.floor(n);
  if (max != null) return Math.min(floored, max);
  return floored;
}

export function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBoolFilter(
  value: string | null | undefined
): "" | "true" | "false" {
  if (value === "true" || value === "false") return value;
  return "";
}

export function escapeIlike(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ")
    .replace(/"/g, "");
}

export function isSafeHttpsUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function parsePositiveBigIntId(
  raw: string | number | null | undefined
): number | null {
  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw) || raw < 1) return null;
    return raw;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

export function getSearchParam(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string | null {
  if (input instanceof URLSearchParams) return input.get(key);
  const value = input[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

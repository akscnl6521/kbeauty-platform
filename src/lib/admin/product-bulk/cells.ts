/**
 * Client/server-safe helpers for bulk spreadsheet cells.
 */
import {
  normalizeManualSlug,
  slugifyBrandAndName,
} from "@/lib/admin/productSlug";

export function cell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return String(value).trim();
}

export function resolveBulkSlug(
  brand: string,
  productName: string,
  rawSlug: string
): string {
  const manual = normalizeManualSlug(rawSlug);
  if (manual) return manual;
  return slugifyBrandAndName(brand, productName);
}

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
}

export function truthyFlag(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return true;
  return !["false", "0", "no", "n", "off"].includes(v);
}

/**
 * Client/server-safe product slug helpers for admin registration UI.
 */
import { slugifyKoreanProductName } from "@/lib/catalog/enrichment/koreanProductSlug";

/**
 * Auto-slug for a new product.
 *
 * Delegates to the shared generator, which romanises Hangul before slugifying.
 * The previous implementation stripped everything outside `\w` after NFKD, which
 * deleted Korean entirely — "원더밤 200ml" became "-200ml" and "옥용팩" collapsed to
 * just the brand. That defect had degraded 53 of 92 catalog slugs before it was
 * found.
 *
 * Two deliberate behaviour changes came with the swap:
 *   - Korean names romanise instead of collapsing.
 *   - Punctuation between letters becomes a separator instead of being deleted,
 *     so "AHA/BHA" slugs to "aha-bha" rather than fusing into "ahabha". The
 *     catalog already stored "cosrx-aha-bha-clarifying-treatment-toner", so this
 *     matches the convention the data was already using.
 *
 * Latin-only names are otherwise unchanged — pinned in
 * scripts/korean-product-slug-selftest.ts.
 */
export function slugifyBrandAndName(brand: string, name: string): string {
  return slugifyKoreanProductName(brand, name);
}

/**
 * Normalise a slug a human typed. Deliberately left as it was: it governs manual
 * input rather than generation, and underscores are legal in a hand-written slug.
 */
export function normalizeManualSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

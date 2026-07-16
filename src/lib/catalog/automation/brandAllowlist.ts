/**
 * Brand official domain allowlist (admin-verified only).
 * Domains are never inferred from similar names alone.
 */

import {
  KR_BRAND_SEED_REGISTRY,
  type KrBrandSeedEntry,
} from "@/lib/catalog/bulkKr/brandRegistry";

export type BrandOfficialAllowlistEntry = KrBrandSeedEntry;

export const BRAND_OFFICIAL_ALLOWLIST: BrandOfficialAllowlistEntry[] =
  KR_BRAND_SEED_REGISTRY;

export function isDomainOnBrandAllowlist(
  hostname: string,
  brandCanonical?: string
): BrandOfficialAllowlistEntry | null {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  for (const entry of KR_BRAND_SEED_REGISTRY) {
    const match = entry.officialDomains.some((d) => {
      const dom = d.toLowerCase().replace(/^www\./, "");
      return host === dom || host.endsWith(`.${dom}`);
    });
    if (!match) continue;
    if (
      brandCanonical &&
      entry.canonicalBrand.toLowerCase() !== brandCanonical.toLowerCase()
    ) {
      continue;
    }
    return entry;
  }
  return null;
}

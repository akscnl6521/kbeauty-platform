/**
 * Brand official domain allowlist (admin-verified only).
 * Domains are never inferred from similar names alone.
 */

export type BrandOfficialAllowlistEntry = {
  brandId: string;
  canonicalBrand: string;
  officialDomains: string[];
  country: string;
  language: string;
  allowsAutomation: boolean;
  productSitemapUrl?: string;
  collectionUrls?: string[];
  parserType: string;
  rateLimitPerMinute: number;
  lastTermsReviewAt: string | null;
};

export const BRAND_OFFICIAL_ALLOWLIST: BrandOfficialAllowlistEntry[] = [
  {
    brandId: "cosrx",
    canonicalBrand: "COSRX",
    officialDomains: ["cosrx.co.kr", "www.cosrx.co.kr", "cosrx.com", "www.cosrx.com"],
    country: "KR",
    language: "ko",
    // Preview: live crawl off until terms/robots reviewed for automation
    allowsAutomation: false,
    productSitemapUrl: undefined,
    collectionUrls: [],
    parserType: "brand_official",
    rateLimitPerMinute: 6,
    lastTermsReviewAt: null,
  },
];

export function isDomainOnBrandAllowlist(
  hostname: string,
  brandCanonical?: string
): BrandOfficialAllowlistEntry | null {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  for (const entry of BRAND_OFFICIAL_ALLOWLIST) {
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

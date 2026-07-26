/**
 * Country-specific purchase link contracts.
 * Never invents live URLs or stock/price — unverified → null / rejected.
 */

import type { CountryPurchaseLink, RevenueRejectionCode } from "./types";

const HTTPS = /^https:\/\//i;
const FIXTURE_HOST = /\.example(\.com|\.kr)?$/i;

export function isFixturePurchaseUrl(url: string | null): boolean {
  if (!url) return true;
  try {
    const host = new URL(url).hostname;
    return FIXTURE_HOST.test(host) || host === "example.com" || host.endsWith(".example");
  } catch {
    return false;
  }
}

export function validateCountryPurchaseLinks(
  links: CountryPurchaseLink[],
  options: { requireAtLeastOne: boolean },
): { ok: boolean; reasons: RevenueRejectionCode[]; normalized: CountryPurchaseLink[] } {
  const reasons: RevenueRejectionCode[] = [];
  if (options.requireAtLeastOne && links.length === 0) {
    reasons.push("country_link_missing");
  }

  const normalized: CountryPurchaseLink[] = [];
  for (const link of links) {
    const country = link.countryCode?.trim().toUpperCase() ?? "";
    if (!country) {
      reasons.push("country_link_missing");
      continue;
    }

    const url = link.purchaseUrl?.trim() || null;
    if (url && !HTTPS.test(url)) {
      reasons.push("live_url_invented");
      continue;
    }

    const fixtureUrl = url ? isFixturePurchaseUrl(url) : true;
    if (url && !fixtureUrl && !link.verifiedAt) {
      // Live commercial URL without verification is not inventable here —
      // treat as blocked readiness (activation remains off).
      reasons.push("country_link_unverified");
    }

    normalized.push({
      countryCode: country,
      languageCode: link.languageCode?.trim() || null,
      currency: link.currency?.trim() || null,
      purchaseUrl: url,
      shipsToCountry: link.shipsToCountry ?? null,
      inStock: link.inStock ?? null,
      verifiedAt: link.verifiedAt ?? null,
      isFixtureUrl: fixtureUrl,
    });
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)], normalized };
}

export function selectCountryPurchaseLink(
  links: CountryPurchaseLink[],
  countryCode: string,
): CountryPurchaseLink | null {
  const code = countryCode.trim().toUpperCase();
  return links.find((l) => l.countryCode === code) ?? null;
}

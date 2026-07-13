/**
 * Shipping country eligibility helpers (schema ships_to_countries text[]).
 */

export const PRIORITY_SHIPPING_COUNTRIES = [
  "KR",
  "US",
  "CA",
  "GB",
  "AU",
  "JP",
  "CN",
  "IN",
  "SG",
  "MY",
  "PH",
  "TH",
  "VN",
  "ID",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "RU",
] as const;

export type ShippingParseResult = {
  shipsToCountries: string[];
  confidence: number;
  reasons: string[];
  worldwideClaim: boolean;
};

/**
 * Never invent worldwide. Only store explicit country codes found.
 */
export function parseShippingCountries(input: {
  explicitCountries?: string[] | null;
  policyText?: string | null;
  retailerCountry?: string | null;
}): ShippingParseResult {
  const reasons: string[] = [];
  const found = new Set<string>();

  for (const c of input.explicitCountries ?? []) {
    const code = c.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) found.add(code);
  }

  const text = input.policyText ?? "";
  const worldwideClaim = /worldwide|전\s*세계|全球/i.test(text);
  if (worldwideClaim) reasons.push("worldwide_claim_unverified");

  for (const code of PRIORITY_SHIPPING_COUNTRIES) {
    const re = new RegExp(`\\b${code}\\b`, "i");
    if (re.test(text)) found.add(code);
  }

  // Domestic-only heuristic when only retailer country known and no policy
  if (!found.size && input.retailerCountry) {
    const rc = input.retailerCountry.toUpperCase();
    if (rc === "KR" || rc === "US" || rc === "JP") {
      found.add(rc);
      reasons.push("default_retailer_country_only");
      return {
        shipsToCountries: [...found],
        confidence: 0.45,
        reasons,
        worldwideClaim,
      };
    }
  }

  if (!found.size) {
    reasons.push("shipping_unknown");
    return {
      shipsToCountries: [],
      confidence: 0.1,
      reasons,
      worldwideClaim,
    };
  }

  reasons.push("explicit_or_text_countries");
  return {
    shipsToCountries: [...found],
    confidence: worldwideClaim ? 0.4 : 0.75,
    reasons,
    worldwideClaim,
  };
}

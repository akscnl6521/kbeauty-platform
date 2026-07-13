/**
 * Offer ↔ product identity matching.
 */

export type OfferIdentityMatch =
  | "exact_match"
  | "strong_match"
  | "ambiguous"
  | "mismatch";

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchOfferToProduct(input: {
  productName: string;
  brandName: string;
  offerTitle?: string | null;
  offerBrand?: string | null;
  sizeLabel?: string | null;
  offerSize?: string | null;
  sku?: string | null;
  offerSku?: string | null;
}): {
  match: OfferIdentityMatch;
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  const pName = norm(input.productName);
  const oTitle = norm(input.offerTitle);
  const pBrand = norm(input.brandName);
  const oBrand = norm(input.offerBrand);

  if (input.sku && input.offerSku && norm(input.sku) === norm(input.offerSku)) {
    reasons.push("sku_exact");
    return { match: "exact_match", confidence: 0.98, reasons };
  }

  if (oBrand && pBrand && oBrand !== pBrand && !oBrand.includes(pBrand) && !pBrand.includes(oBrand)) {
    reasons.push("brand_mismatch");
    return { match: "mismatch", confidence: 0.9, reasons };
  }

  if (!oTitle) {
    reasons.push("offer_title_missing");
    return { match: "ambiguous", confidence: 0.4, reasons };
  }

  if (oTitle === pName) {
    reasons.push("name_exact");
    if (
      input.sizeLabel &&
      input.offerSize &&
      norm(input.sizeLabel) !== norm(input.offerSize)
    ) {
      reasons.push("size_mismatch");
      return { match: "mismatch", confidence: 0.85, reasons };
    }
    return { match: "exact_match", confidence: 0.95, reasons };
  }

  if (oTitle.includes(pName) || pName.includes(oTitle)) {
    reasons.push("name_contains");
    return { match: "strong_match", confidence: 0.8, reasons };
  }

  const pTokens = new Set(pName.split(" ").filter((t) => t.length > 2));
  const oTokens = oTitle.split(" ").filter((t) => t.length > 2);
  const overlap = oTokens.filter((t) => pTokens.has(t)).length;
  const ratio = pTokens.size ? overlap / pTokens.size : 0;
  if (ratio >= 0.7 && overlap >= 2) {
    reasons.push(`token_overlap_${overlap}`);
    return { match: "strong_match", confidence: 0.72, reasons };
  }
  if (ratio >= 0.4) {
    reasons.push("token_overlap_weak");
    return { match: "ambiguous", confidence: 0.5, reasons };
  }

  reasons.push("name_mismatch");
  return { match: "mismatch", confidence: 0.85, reasons };
}

export function canAutoSaveByIdentity(match: OfferIdentityMatch): boolean {
  return match === "exact_match" || match === "strong_match";
}

/**
 * Disclosure contracts — paid placements must be clearly labeled,
 * never dressed as Organic recommendation reasons.
 */

import {
  DEFAULT_AFFILIATE_DISCLOSURE_EN,
  DEFAULT_AFFILIATE_DISCLOSURE_KO,
  DEFAULT_SPONSORED_DISCLOSURE_EN,
  DEFAULT_SPONSORED_DISCLOSURE_KO,
  ORGANIC_LOOKALIKE_DISCLOSURE_PATTERNS,
} from "./constants";
import type {
  DisclosureContract,
  RevenueLane,
  RevenueRejectionCode,
} from "./types";

export function looksLikeOrganicReason(label: string): boolean {
  const text = label.trim();
  if (!text) return false;
  // Negation / separation statements are disclosures, not Organic lookalikes.
  if (
    /not\s+(?:shown\s+as|an)\s+organic/i.test(text) ||
    /separate\s+from\s+organic/i.test(text) ||
    /organic\s+(?:순위|추천)\s*(?:와|과)?\s*(?:는\s*)?(?:무관|분리)/i.test(text) ||
    /Organic\s+추천\s*순위와는\s*무관/i.test(text)
  ) {
    return false;
  }
  return ORGANIC_LOOKALIKE_DISCLOSURE_PATTERNS.some((re) => re.test(text));
}

export function buildDisclosureContract(input: {
  lane: RevenueLane;
  labelKo: string | null;
  labelEn: string | null;
}): { disclosure: DisclosureContract | null; reasons: RevenueRejectionCode[] } {
  const reasons: RevenueRejectionCode[] = [];
  const labelKo =
    input.labelKo?.trim() ||
    (input.lane === "affiliate"
      ? DEFAULT_AFFILIATE_DISCLOSURE_KO
      : DEFAULT_SPONSORED_DISCLOSURE_KO);
  const labelEn =
    input.labelEn?.trim() ||
    (input.lane === "affiliate"
      ? DEFAULT_AFFILIATE_DISCLOSURE_EN
      : DEFAULT_SPONSORED_DISCLOSURE_EN);

  if (!labelKo.trim() || !labelEn.trim()) {
    reasons.push("disclosure_missing");
    return { disclosure: null, reasons };
  }
  if (looksLikeOrganicReason(labelKo) || looksLikeOrganicReason(labelEn)) {
    reasons.push("disclosure_looks_like_organic_reason");
    return { disclosure: null, reasons };
  }

  return {
    disclosure: {
      required: true,
      labelKo,
      labelEn,
      visibleToUser: true,
      looksLikeOrganicReason: false,
    },
    reasons,
  };
}

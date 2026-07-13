/**
 * Verified offer gate — maps to product_offers schema constraints.
 */

import {
  canAutoVerifyOffer,
  type OfferSourceGrade,
} from "@/lib/pipeline/offers/offer-source-class";
import type { OfferIdentityMatch } from "@/lib/pipeline/offers/offer-identity";
import type { OfferCurrency } from "@/lib/pipeline/offers/offer-price";
import type { SchemaStockStatus } from "@/lib/pipeline/offers/offer-stock";

export type SchemaVerificationStatus =
  | "verified"
  | "unverified"
  | "invalid"
  | "unavailable";

export type OfferGateInput = {
  grade: OfferSourceGrade;
  identity: OfferIdentityMatch;
  identityConfidence: number;
  purchaseUrl: string;
  price: number | null;
  currency: OfferCurrency | null;
  stockStatus: SchemaStockStatus;
  stockConfidence: number;
  shipsToCountries: string[];
  shippingConfidence: number;
  officialConfidenceThreshold: number;
  productActive: boolean | null;
};

export type OfferGateResult = {
  passVerified: boolean;
  schemaStatus: SchemaVerificationStatus;
  needsReview: boolean;
  blockers: string[];
  reasons: string[];
};

export function evaluateOfferVerificationGate(
  input: OfferGateInput
): OfferGateResult {
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (!input.purchaseUrl.startsWith("https://")) {
    blockers.push("https_required");
  }
  if (input.identity === "mismatch") blockers.push("identity_mismatch");
  if (input.identity === "ambiguous") blockers.push("identity_ambiguous");
  if (
    input.identity !== "exact_match" &&
    input.identity !== "strong_match"
  ) {
    blockers.push("identity_not_strong");
  }
  if (input.identityConfidence < 0.7) blockers.push("identity_confidence_low");
  if (input.price == null || input.price <= 0) blockers.push("price_invalid");
  if (!input.currency) blockers.push("currency_missing");
  if (input.stockStatus !== "in_stock") blockers.push("not_in_stock");
  if (input.stockConfidence < 0.7) blockers.push("stock_confidence_low");
  if (!input.shipsToCountries.length) blockers.push("shipping_missing");
  if (input.shippingConfidence < 0.5) blockers.push("shipping_confidence_low");
  if (!canAutoVerifyOffer(input.grade)) {
    blockers.push(`grade_${input.grade}_not_auto_verify`);
  }
  // Draft products (active=false) MAY receive verified offers.
  // Product activation + Top5 still require products.active + verified_at.
  void input.productActive;

  if (input.grade === "marketplace_seller") {
    return {
      passVerified: false,
      schemaStatus: "invalid",
      needsReview: false,
      blockers: ["marketplace_seller_excluded"],
      reasons: [],
    };
  }

  if (blockers.includes("identity_mismatch")) {
    return {
      passVerified: false,
      schemaStatus: "invalid",
      needsReview: false,
      blockers,
      reasons,
    };
  }

  const needsReview =
    blockers.includes("identity_ambiguous") ||
    blockers.includes("shipping_missing") ||
    blockers.includes("shipping_confidence_low") ||
    input.grade === "retailer_unverified" ||
    input.grade === "marketplace_official_store";

  if (!blockers.length) {
    reasons.push("verified_gate_pass");
    return {
      passVerified: true,
      schemaStatus: "verified",
      needsReview: false,
      blockers,
      reasons,
    };
  }

  return {
    passVerified: false,
    schemaStatus: "unverified",
    needsReview,
    blockers,
    reasons,
  };
}

export function freshnessExpiresAt(
  hours: number,
  from: Date = new Date()
): string {
  return new Date(from.getTime() + hours * 3600_000).toISOString();
}

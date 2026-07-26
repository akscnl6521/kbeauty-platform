/**
 * P3-T04 Affiliate and sponsored revenue readiness — public exports.
 */

export * from "./types";
export * from "./constants";
export * from "./disclosure";
export * from "./commissionSafety";
export * from "./countryPurchaseLinks";
export * from "./affiliateOfferIngestion";
export * from "./sponsoredPlacement";
export * from "./expiryHandling";
export * from "./adminApproval";
export * from "./clickConversionEvents";
export * from "./organicIndependence";
export * from "./fixtures";
export * from "./audit";
export {
  runRevenueReadiness,
  runFixtureRevenueReadiness,
  assertNoCommercialActivation,
} from "./pipeline";
export type { RunRevenueReadinessInput } from "./pipeline";

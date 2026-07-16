/**
 * Per-product status bundle (product / ingredient / media / offer / variant / claim).
 */

export type TrustStatusValue =
  | "source_verified"
  | "needs_review"
  | "missing"
  | "broken"
  | "not_applicable"
  | "prohibited";

export type CatalogTrustStatusBundle = {
  productStatus: TrustStatusValue;
  ingredientStatus: TrustStatusValue;
  mediaStatus: TrustStatusValue;
  offerStatus: TrustStatusValue;
  variantStatus: TrustStatusValue;
  claimStatus: TrustStatusValue;
};

export function canExposeToUser(bundle: CatalogTrustStatusBundle): boolean {
  return (
    bundle.productStatus === "source_verified" &&
    bundle.ingredientStatus === "source_verified"
  );
}

export function mediaDisplayMode(
  bundle: CatalogTrustStatusBundle
): "verified" | "fallback" | "hide" {
  if (bundle.mediaStatus === "prohibited") return "hide";
  if (bundle.mediaStatus === "source_verified") return "verified";
  return "fallback";
}

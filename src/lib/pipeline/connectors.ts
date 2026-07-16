/**
 * Connector registry — brand exceptions live in config data, not infinite if/else.
 */

export type ConnectorId =
  | "generic_sitemap"
  | "generic_shopify"
  | "generic_woocommerce"
  | "generic_nextjs"
  | "generic_static"
  | "custom_fallback";

export type BrandConnectorOverride = {
  brandKey: string;
  preferredConnector?: ConnectorId;
  extraSitemapPaths?: string[];
  productUrlIncludes?: string[];
  productUrlExcludes?: string[];
  notes?: string;
};

/** Runtime overrides — populate via data file later; empty by default. */
export const BRAND_CONNECTOR_OVERRIDES: BrandConnectorOverride[] = [];

export function getBrandOverride(brandKey: string): BrandConnectorOverride | null {
  return BRAND_CONNECTOR_OVERRIDES.find((o) => o.brandKey === brandKey) ?? null;
}

export const DEFAULT_CONNECTOR_ORDER: ConnectorId[] = [
  "generic_sitemap",
  "generic_shopify",
  "generic_woocommerce",
  "generic_nextjs",
  "generic_static",
  "custom_fallback",
];

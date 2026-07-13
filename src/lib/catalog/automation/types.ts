/**
 * Catalog automation types (staging / connectors).
 * Display-only scoring systems (rankProducts) are intentionally separate.
 */

export type SourceAuthorizationStatus =
  | "approved"
  | "manual_review"
  | "api_credentials_required"
  | "prohibited"
  | "suspended";

export type CatalogSourceRecord = {
  id: string;
  name: string;
  sourceType: string;
  sourceTier: 1 | 2 | 3 | 4;
  baseUrl: string | null;
  countryCode: string | null;
  languageCode: string | null;
  retailerType: string | null;
  isOfficialBrandSource: boolean;
  isAuthorizedRetailer: boolean;
  automationAllowed: boolean;
  authorizationStatus: SourceAuthorizationStatus;
  robotsStatus: string;
  termsStatus: string;
  parserType: string | null;
  rateLimitPerMinute: number;
  isActive: boolean;
};

export type SourcePermissionResult =
  | {
      ok: true;
      status: "allowed";
    }
  | {
      ok: false;
      status: "authorization_required" | "prohibited" | "suspended" | "robots_disallow";
      reason: string;
      nextAction: string;
    };

export type DiscoveredProduct = {
  externalProductId?: string;
  brandRaw: string;
  productNameRaw: string;
  categoryRaw?: string;
  officialProductUrl?: string;
  discoveryUrl?: string;
  sourceTier: 1 | 2 | 3 | 4;
  notes?: string;
};

export type FetchedProductDocument = {
  url: string;
  httpStatus: number;
  fetchedAt: string;
  contentType?: string;
  html?: string;
  json?: unknown;
  contentHash: string;
  sourceMethod: string;
};

export type ParsedCatalogProduct = {
  brandRaw: string;
  brandCanonical?: string;
  productNameRaw: string;
  productNameKo?: string;
  productNameEn?: string;
  categoryRaw?: string;
  categoryCanonical?: string;
  productType?: string;
  sizeValue?: number;
  sizeUnit?: string;
  form?: string;
  descriptionRaw?: string;
  shadeFamily?: string;
  shades?: unknown[];
  finish?: string;
  coverage?: string;
  spfValue?: number;
  paRating?: string;
  imageUrls: string[];
  primaryImageUrl?: string;
  officialProductUrl?: string;
  barcode?: string;
  gtin?: string;
  sku?: string;
  sourceUrls: string[];
  sourceTier: 1 | 2 | 3 | 4;
};

export type ParsedIngredientToken = {
  displayOrder: number;
  ingredientRaw: string;
  inciName?: string;
  canonicalKey?: string;
  nameKo?: string;
  normalizationStatus: "raw" | "parsed" | "normalized" | "unknown" | "needs_review";
  confidence: number;
  section?: "main" | "may_contain" | "plus_minus_colorants";
  notes?: string[];
};

export type ParsedIngredientSource = {
  ingredientsRaw: string;
  sourceUrl: string;
  sourceType: string;
  sourceTier: 1 | 2 | 3 | 4;
  sourceVerified: boolean;
  tokens: ParsedIngredientToken[];
};

export type ParsedCatalogOffer = {
  externalOfferId?: string;
  retailerNameRaw: string;
  retailerNameCanonical?: string;
  sellerName?: string;
  sellerType?: string;
  countryCode: string;
  currency?: string;
  price?: number;
  originalPrice?: number;
  displayedPrice?: number;
  priceType?: string;
  optionName?: string;
  membershipRequired?: boolean;
  couponRequired?: boolean;
  inStock?: boolean | null;
  availabilityRaw?: string;
  shipsTo: string[];
  purchaseUrl: string;
  isOfficialStore: boolean;
  isAuthorizedRetailer: boolean;
  sourceVerified: boolean;
};

export type CatalogConnectorContext = {
  source: CatalogSourceRecord;
  dryRun: boolean;
  autoPromote: boolean;
  maxProducts: number;
  categories?: string[];
  /** Fixture documents for offline dry-run (no live fetch). */
  fixtures?: FetchedProductDocument[];
};

export interface CatalogConnector {
  id: string;
  canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult>;
  discoverProducts(context: CatalogConnectorContext): Promise<DiscoveredProduct[]>;
  fetchProduct(input: {
    source: CatalogSourceRecord;
    discovered: DiscoveredProduct;
    fixtures?: FetchedProductDocument[];
  }): Promise<
    | FetchedProductDocument
    | SourcePermissionResult
  >;
  parseProduct(document: FetchedProductDocument): Promise<ParsedCatalogProduct | null>;
  parseIngredients(
    document: FetchedProductDocument,
    product: ParsedCatalogProduct
  ): Promise<ParsedIngredientSource | null>;
  parseOffers(
    document: FetchedProductDocument,
    product: ParsedCatalogProduct
  ): Promise<ParsedCatalogOffer[]>;
}

export type AutomationRuntimeConfig = {
  dryRun: boolean;
  autoPromote: boolean;
  maxProductsPerSource: number;
  maxProductsTotal: number;
  cronEnabled: boolean;
};

export const DEFAULT_AUTOMATION_CONFIG: AutomationRuntimeConfig = {
  dryRun: true,
  autoPromote: false,
  maxProductsPerSource: 20,
  maxProductsTotal: 50,
  cronEnabled: false,
};

/** Makeup categories excluded from skincare rankProducts. */
export const COLOR_MAKEUP_CATEGORIES = new Set([
  "lipstick",
  "lip_tint",
  "lip_gloss",
  "lip_liner",
  "primer",
  "foundation",
  "cushion",
  "concealer",
  "powder",
  "setting_spray",
  "blusher",
  "highlighter",
  "contour",
  "eyeshadow",
  "eyeliner",
  "mascara",
  "brow",
]);

export const SKINCARE_CATEGORIES = new Set([
  "cleanser",
  "makeup_remover",
  "toner",
  "essence",
  "serum",
  "ampoule",
  "lotion",
  "cream",
  "eye_cream",
  "mask",
  "sunscreen",
  "sun_stick",
  "lip_balm",
  "lip_mask",
  "bodycare",
  "haircare",
]);

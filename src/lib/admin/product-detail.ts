import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { isSafeHttpsUrl } from "@/lib/admin/query";

export { isSafeHttpsUrl };

const MAX_BIGINT = Number.MAX_SAFE_INTEGER;

const OFFICIAL_SOURCE_TYPES = new Set([
  "official_brand_page",
  "official_label",
  "official_retailer",
]);

const PRODUCT_SELECT = [
  "id",
  "name",
  "slug",
  "brand",
  "category",
  "skin_concern",
  "skin_tone",
  "key_ingredients",
  "full_ingredients",
  "recommendation_reason",
  "active",
  "verified_at",
  "data_confidence",
  "fragrance_free",
  "alcohol_free",
  "texture",
  "usage_area",
  "created_at",
  "price_usd",
  "where_to_find_us",
  "where_to_find_jp",
  "link_sephora",
  "link_amazon_us",
  "link_amazon_jp",
  "link_qoo10",
  "link_oliveyoung",
  "link_coupang",
  "link_yesstyle",
].join(", ");

const OFFER_SELECT = [
  "id",
  "retailer_name",
  "retailer_country",
  "ships_to_countries",
  "purchase_url",
  "price",
  "currency",
  "stock_status",
  "verification_status",
  "is_official",
  "verified_at",
  "last_checked_at",
  "active",
].join(", ");

const VARIANT_SELECT = [
  "id",
  "country_code",
  "size_value",
  "size_unit",
  "variant_name",
  "formula_version",
  "package_version",
  "launch_date",
  "discontinued_at",
  "verification_status",
  "active",
  "created_at",
  "updated_at",
].join(", ");

const PRODUCT_INGREDIENT_SELECT = [
  "id",
  "ingredient_id",
  "variant_id",
  "ingredient_order",
  "is_key_ingredient",
  "source_type",
  "source_url",
  "verification_status",
  "verified_at",
].join(", ");

export type AdminProductOfferItem = {
  id: string;
  retailerName: string;
  retailerCountry: string;
  shipsToCountries: string[];
  purchaseUrl: string;
  purchaseUrlSafeHttps: boolean;
  price: number | null;
  currency: string | null;
  stockStatus: string;
  verificationStatus: string;
  isOfficial: boolean | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  active: boolean;
  qualifiesAsVerifiedOffer: boolean;
};

export type AdminProductIngredientItem = {
  id: string;
  ingredientId: number;
  variantId: string | null;
  ingredientOrder: number;
  isKeyIngredient: boolean;
  sourceType: string | null;
  sourceUrl: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
  ingredientSlug: string | null;
  ingredientNameEn: string | null;
  ingredientNameKo: string | null;
  isApprovedStructured: boolean;
};

export type AdminProductVariantItem = {
  id: string;
  countryCode: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  variantName: string | null;
  formulaVersion: string | null;
  packageVersion: string | null;
  launchDate: string | null;
  discontinuedAt: string | null;
  verificationStatus: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminProductStatusSummary = {
  active: boolean;
  productVerified: boolean;
  structuredIngredientsComplete: boolean;
  hasVerifiedOffer: boolean;
  recommendationEligible: boolean;
  structuredIngredientCount: number;
  approvedStructuredIngredientCount: number;
  offerCount: number;
  verifiedOfferCount: number;
  variantCount: number;
  legacyKeyIngredientCount: number;
  legacyFullIngredientCount: number;
  /** Why auto-verify / recommendation failed */
  verificationBlockers: string[];
  recommendationBlockers: string[];
  countryEligibleOfferCountKr: number;
};

export type AdminProductDetail = {
  id: number;
  name: string;
  slug: string | null;
  brand: string;
  category: string | null;
  skinConcern: string[];
  skinTone: string[];
  keyIngredients: string[];
  fullIngredients: string[];
  recommendationReason: string | null;
  active: boolean | null;
  verifiedAt: string | null;
  dataConfidence: string | null;
  fragranceFree: boolean | null;
  alcoholFree: boolean | null;
  texture: string | null;
  usageArea: string | null;
  createdAt: string | null;
  legacy: {
    priceUsd: number | null;
    whereToFindUs: string | null;
    whereToFindJp: string | null;
    links: Array<{ key: string; url: string; safeHttps: boolean }>;
  };
};

export type AdminProductDetailPayload = {
  product: AdminProductDetail;
  variants: AdminProductVariantItem[];
  ingredients: AdminProductIngredientItem[];
  offers: AdminProductOfferItem[];
  statusSummary: AdminProductStatusSummary;
};

/**
 * Parse route/API product id. Positive safe integer only.
 */
export function parseAdminProductId(
  raw: string | number | null | undefined
): number | null {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 1 || raw > MAX_BIGINT) return null;
    return raw;
  }

  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isApprovedStructuredIngredient(row: {
  verification_status: string;
  verified_at: string | null;
  source_url: string | null;
  source_type: string | null;
}): boolean {
  if (row.verification_status !== "approved") return false;
  if (!row.verified_at) return false;
  if (!row.source_url || !row.source_url.trim()) return false;
  if (!row.source_type || !OFFICIAL_SOURCE_TYPES.has(row.source_type)) {
    return false;
  }
  return true;
}

function qualifiesAsVerifiedOffer(row: {
  active: boolean;
  verification_status: string;
  stock_status: string;
  verified_at: string | null;
  purchase_url: string;
}): boolean {
  return (
    row.active === true &&
    row.verification_status === "verified" &&
    row.stock_status === "in_stock" &&
    Boolean(row.verified_at) &&
    isSafeHttpsUrl(row.purchase_url)
  );
}

function buildLegacyLinks(row: Record<string, unknown>) {
  const keys = [
    "link_sephora",
    "link_amazon_us",
    "link_amazon_jp",
    "link_qoo10",
    "link_oliveyoung",
    "link_coupang",
    "link_yesstyle",
  ] as const;

  const links: Array<{ key: string; url: string; safeHttps: boolean }> = [];
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      const url = value.trim();
      links.push({ key, url, safeHttps: isSafeHttpsUrl(url) });
    }
  }
  return links;
}

/**
 * Read-only admin product detail. SELECT only.
 * Returns null when the product does not exist.
 */
export async function getAdminProductDetail(
  productId: number
): Promise<AdminProductDetailPayload | null> {
  if (!Number.isSafeInteger(productId) || productId < 1) {
    return null;
  }

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin product detail.");
  }

  try {
    const { data: productRow, error: productError } = await client
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      throw new AdminConfigurationError("Unable to load admin product detail.");
    }
    if (!productRow) return null;

    const productRecord = productRow as unknown as Record<string, unknown>;

    const [offersRes, variantsRes, ingredientsRes] = await Promise.all([
      client
        .from("product_offers")
        .select(OFFER_SELECT)
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
      client
        .from("product_variants")
        .select(VARIANT_SELECT)
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
      client
        .from("product_ingredients")
        .select(PRODUCT_INGREDIENT_SELECT)
        .eq("product_id", productId)
        .order("ingredient_order", { ascending: true }),
    ]);

    if (offersRes.error || variantsRes.error || ingredientsRes.error) {
      throw new AdminConfigurationError("Unable to load admin product detail.");
    }

    const ingredientRows = (ingredientsRes.data ?? []) as unknown as Array<{
      id: string;
      ingredient_id: number | string;
      variant_id: string | null;
      ingredient_order: number;
      is_key_ingredient: boolean;
      source_type: string | null;
      source_url: string | null;
      verification_status: string;
      verified_at: string | null;
    }>;

    const ingredientIds = [
      ...new Set(
        ingredientRows
          .map((row) => Number(row.ingredient_id))
          .filter((id) => Number.isSafeInteger(id) && id > 0)
      ),
    ];

    const ingredientNameById = new Map<
      number,
      { slug: string; nameEn: string; nameKo: string | null }
    >();

    if (ingredientIds.length > 0) {
      const { data: ingredientMeta, error: ingredientMetaError } = await client
        .from("ingredients")
        .select("id, slug, name_en, name_ko")
        .in("id", ingredientIds);

      if (ingredientMetaError) {
        throw new AdminConfigurationError(
          "Unable to load admin product detail."
        );
      }

      for (const row of ingredientMeta ?? []) {
        const record = row as unknown as {
          id: number | string;
          slug: string;
          name_en: string;
          name_ko: string | null;
        };
        const id = Number(record.id);
        if (!Number.isSafeInteger(id)) continue;
        ingredientNameById.set(id, {
          slug: record.slug,
          nameEn: record.name_en,
          nameKo: record.name_ko,
        });
      }
    }

    const offers: AdminProductOfferItem[] = (
      (offersRes.data ?? []) as unknown as Array<{
        id: string;
        retailer_name: string;
        retailer_country: string;
        ships_to_countries: string[] | null;
        purchase_url: string;
        price: number | string | null;
        currency: string | null;
        stock_status: string;
        verification_status: string;
        is_official: boolean | null;
        verified_at: string | null;
        last_checked_at: string | null;
        active: boolean;
      }>
    ).map((row) => {
      const purchaseUrl = row.purchase_url;
      const qualifies = qualifiesAsVerifiedOffer(row);
      return {
        id: row.id,
        retailerName: row.retailer_name,
        retailerCountry: row.retailer_country,
        shipsToCountries: asStringArray(row.ships_to_countries),
        purchaseUrl,
        purchaseUrlSafeHttps: isSafeHttpsUrl(purchaseUrl),
        price:
          row.price == null || row.price === ""
            ? null
            : Number(row.price),
        currency: row.currency,
        stockStatus: row.stock_status,
        verificationStatus: row.verification_status,
        isOfficial: row.is_official,
        verifiedAt: row.verified_at,
        lastCheckedAt: row.last_checked_at,
        active: row.active,
        qualifiesAsVerifiedOffer: qualifies,
      };
    });

    const variants: AdminProductVariantItem[] = (
      (variantsRes.data ?? []) as unknown as Array<{
        id: string;
        country_code: string | null;
        size_value: number | string | null;
        size_unit: string | null;
        variant_name: string | null;
        formula_version: string | null;
        package_version: string | null;
        launch_date: string | null;
        discontinued_at: string | null;
        verification_status: string;
        active: boolean;
        created_at: string;
        updated_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      countryCode: row.country_code,
      sizeValue:
        row.size_value == null || row.size_value === ""
          ? null
          : Number(row.size_value),
      sizeUnit: row.size_unit,
      variantName: row.variant_name,
      formulaVersion: row.formula_version,
      packageVersion: row.package_version,
      launchDate: row.launch_date,
      discontinuedAt: row.discontinued_at,
      verificationStatus: row.verification_status,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const ingredients: AdminProductIngredientItem[] = ingredientRows.map(
      (row) => {
        const ingredientId = Number(row.ingredient_id);
        const meta = ingredientNameById.get(ingredientId);
        const approved = isApprovedStructuredIngredient(row);
        return {
          id: row.id,
          ingredientId,
          variantId: row.variant_id,
          ingredientOrder: row.ingredient_order,
          isKeyIngredient: row.is_key_ingredient,
          sourceType: row.source_type,
          sourceUrl: row.source_url,
          verificationStatus: row.verification_status,
          verifiedAt: row.verified_at,
          ingredientSlug: meta?.slug ?? null,
          ingredientNameEn: meta?.nameEn ?? null,
          ingredientNameKo: meta?.nameKo ?? null,
          isApprovedStructured: approved,
        };
      }
    );

    const keyIngredients = asStringArray(productRecord.key_ingredients);
    const fullIngredients = asStringArray(productRecord.full_ingredients);
    const active = productRecord.active === true;
    const verifiedAt =
      typeof productRecord.verified_at === "string"
        ? productRecord.verified_at
        : null;
    const productVerified = Boolean(verifiedAt);
    const approvedStructuredIngredientCount = ingredients.filter(
      (item) => item.isApprovedStructured
    ).length;
    const structuredIngredientsComplete = approvedStructuredIngredientCount > 0;
    const verifiedOfferCount = offers.filter(
      (item) => item.qualifiesAsVerifiedOffer
    ).length;
    const hasVerifiedOffer = verifiedOfferCount > 0;

    const verificationBlockers: string[] = [];
    if (!active) verificationBlockers.push("product_not_active");
    if (!productVerified) verificationBlockers.push("product_not_verified");
    if (!structuredIngredientsComplete) {
      verificationBlockers.push("structured_ingredients_incomplete");
    }
    if (!hasVerifiedOffer) verificationBlockers.push("verified_offer_missing");

    const countryEligibleOfferCountKr = offers.filter(
      (o) =>
        o.qualifiesAsVerifiedOffer &&
        o.retailerCountry === "KR" &&
        o.shipsToCountries.includes("KR") &&
        o.currency === "KRW" &&
        o.stockStatus === "in_stock"
    ).length;

    const recommendationBlockers: string[] = [...verificationBlockers];
    if (countryEligibleOfferCountKr < 1) {
      recommendationBlockers.push("no_kr_country_eligible_verified_offer");
    }

    const recommendationEligible =
      active &&
      productVerified &&
      structuredIngredientsComplete &&
      hasVerifiedOffer &&
      countryEligibleOfferCountKr > 0;

    const product: AdminProductDetail = {
      id: Number(productRecord.id),
      name: String(productRecord.name),
      slug:
        typeof productRecord.slug === "string" ? productRecord.slug : null,
      brand: String(productRecord.brand),
      category:
        typeof productRecord.category === "string"
          ? productRecord.category
          : null,
      skinConcern: asStringArray(productRecord.skin_concern),
      skinTone: asStringArray(productRecord.skin_tone),
      keyIngredients,
      fullIngredients,
      recommendationReason:
        typeof productRecord.recommendation_reason === "string"
          ? productRecord.recommendation_reason
          : null,
      active:
        typeof productRecord.active === "boolean"
          ? productRecord.active
          : null,
      verifiedAt,
      dataConfidence:
        typeof productRecord.data_confidence === "string"
          ? productRecord.data_confidence
          : null,
      fragranceFree:
        typeof productRecord.fragrance_free === "boolean"
          ? productRecord.fragrance_free
          : null,
      alcoholFree:
        typeof productRecord.alcohol_free === "boolean"
          ? productRecord.alcohol_free
          : null,
      texture:
        typeof productRecord.texture === "string"
          ? productRecord.texture
          : null,
      usageArea:
        typeof productRecord.usage_area === "string"
          ? productRecord.usage_area
          : null,
      createdAt:
        typeof productRecord.created_at === "string"
          ? productRecord.created_at
          : null,
      legacy: {
        priceUsd:
          productRecord.price_usd == null
            ? null
            : Number(productRecord.price_usd),
        whereToFindUs:
          typeof productRecord.where_to_find_us === "string"
            ? productRecord.where_to_find_us
            : null,
        whereToFindJp:
          typeof productRecord.where_to_find_jp === "string"
            ? productRecord.where_to_find_jp
            : null,
        links: buildLegacyLinks(productRecord),
      },
    };

    const statusSummary: AdminProductStatusSummary = {
      active,
      productVerified,
      structuredIngredientsComplete,
      hasVerifiedOffer,
      recommendationEligible,
      structuredIngredientCount: ingredients.length,
      approvedStructuredIngredientCount,
      offerCount: offers.length,
      verifiedOfferCount,
      variantCount: variants.length,
      legacyKeyIngredientCount: keyIngredients.length,
      legacyFullIngredientCount: fullIngredients.length,
      verificationBlockers,
      recommendationBlockers,
      countryEligibleOfferCountKr,
    };

    return {
      product,
      variants,
      ingredients,
      offers,
      statusSummary,
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin product detail.");
  }
}

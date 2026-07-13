import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  buildCatalogAuditReport,
  catalogAuditToCsv,
  type CatalogAuditOfferRow,
  type CatalogAuditProductRow,
  type CatalogAuditReport,
  type CatalogTrustStatus,
} from "@/lib/catalog/catalogAudit";

const PRODUCT_SELECT =
  "id, name, name_ko, name_ja, brand, category, active, verified_at, data_confidence, key_ingredients, skin_concern, slug";

const OFFER_SELECT =
  "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, verified_at, active";

function mapProduct(row: Record<string, unknown>): CatalogAuditProductRow {
  return {
    id: String(row.id),
    brand: String(row.brand ?? ""),
    name: String(row.name ?? ""),
    nameKo: row.name_ko == null ? null : String(row.name_ko),
    nameJa: row.name_ja == null ? null : String(row.name_ja),
    category: row.category == null ? null : String(row.category),
    active: row.active !== false,
    verifiedAt: row.verified_at == null ? null : String(row.verified_at),
    dataConfidence:
      row.data_confidence == null ? null : String(row.data_confidence),
    keyIngredients: Array.isArray(row.key_ingredients)
      ? row.key_ingredients.map(String)
      : [],
    skinConcern: row.skin_concern ?? null,
    // products 테이블에 image_url 컬럼 없음 — 이미지 누락으로 집계
    imageUrl: null,
    slug: row.slug == null ? null : String(row.slug),
    sourceUrl: null,
  };
}

function mapOffer(row: Record<string, unknown>): CatalogAuditOfferRow {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    retailerName: String(row.retailer_name ?? ""),
    retailerCountry: String(row.retailer_country ?? ""),
    shipsToCountries: Array.isArray(row.ships_to_countries)
      ? row.ships_to_countries.map(String)
      : [],
    purchaseUrl: String(row.purchase_url ?? ""),
    price: row.price == null ? null : Number(row.price),
    currency: row.currency == null ? null : String(row.currency),
    stockStatus: String(row.stock_status ?? "unknown"),
    verificationStatus: String(row.verification_status ?? "unverified"),
    isOfficial: typeof row.is_official === "boolean" ? row.is_official : null,
    verifiedAt: row.verified_at == null ? null : String(row.verified_at),
    active: typeof row.active === "boolean" ? row.active : null,
  };
}

async function fetchAllRows(
  client: SupabaseClient,
  table: string,
  select: string
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  let from = 0;
  const out: Record<string, unknown>[] = [];

  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new AdminConfigurationError(`Unable to load ${table} for catalog audit.`);
    }
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

export async function loadCatalogAuditReport(
  client?: SupabaseClient
): Promise<CatalogAuditReport> {
  const db = client ?? createSupabaseAdminClient();
  const [productRows, offerRows] = await Promise.all([
    fetchAllRows(db, "products", PRODUCT_SELECT),
    fetchAllRows(db, "product_offers", OFFER_SELECT),
  ]);

  const products = productRows.map(mapProduct);
  const offers = offerRows.map(mapOffer);
  const report = buildCatalogAuditReport(products, offers);
  // 스키마에 이미지 컬럼이 없으므로 전 제품 이미지 누락으로 기록
  report.summary.missingImage = report.summary.totalProducts;
  return report;
}

export type CatalogAdminListParams = {
  status?: string | null;
  brand?: string | null;
  search?: string | null;
  productId?: string | null;
  priority?: string | null;
};

export function filterCatalogAuditProducts(
  report: CatalogAuditReport,
  params: CatalogAdminListParams
): CatalogAuditReport["products"] {
  const status = (params.status ?? "").trim() as CatalogTrustStatus | "";
  const brand = (params.brand ?? "").trim().toLowerCase();
  const search = (params.search ?? "").trim().toLowerCase();
  const productId = (params.productId ?? "").trim();
  const priority = (params.priority ?? "").trim();

  return report.products.filter((p) => {
    if (status && p.status !== status) return false;
    if (brand && !p.brand.toLowerCase().includes(brand)) return false;
    if (productId && p.id !== productId) return false;
    if (priority && String(p.queuePriority) !== priority) return false;
    if (search) {
      const hay = `${p.displayNameKo} ${p.displayNameEn} ${p.brand} ${p.id}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export function buildCatalogAdminCsv(
  products: CatalogAuditReport["products"]
): string {
  return catalogAuditToCsv(
    products.map((p) => ({
      id: p.id,
      brand: p.brand,
      display_name_ko: p.displayNameKo,
      display_name_en: p.displayNameEn,
      size: p.sizeLabel,
      status: p.status,
      verified_at: p.verifiedAt,
      kr_strict_offer: p.hasKrStrictOffer,
      us_strict_offer: p.hasUsStrictOffer,
      jp_strict_offer: p.hasJpStrictOffer,
      offer_count: p.offerCount,
      kr_price: p.krPrice,
      kr_retailer: p.krRetailer,
      kr_stock: p.krStock,
      review_reasons: p.reviewReasons.join("; "),
      eligibility_failures: p.eligibilityFailures.join("; "),
      duplicate_group: p.duplicateGroupKey,
      duplicate_peers: p.duplicatePeerIds.join("|"),
      queue_priority: p.queuePriority,
    }))
  );
}

export function buildCatalogReportArtifacts(report: CatalogAuditReport): {
  summaryJson: string;
  productsCsv: string;
  duplicatesCsv: string;
  offerGapsCsv: string;
} {
  return {
    summaryJson: JSON.stringify(report.summary, null, 2),
    productsCsv: buildCatalogAdminCsv(report.products),
    duplicatesCsv: catalogAuditToCsv(
      report.duplicateGroups.map((g) => ({
        group_key: g.key,
        brand: g.brand,
        name_key: g.nameKey,
        size: g.sizeLabel,
        product_ids: g.productIds.join("|"),
        count: g.productIds.length,
      }))
    ),
    offerGapsCsv: catalogAuditToCsv(
      report.offerGaps.map((g) => ({
        product_id: g.productId,
        brand: g.brand,
        display_name_ko: g.displayNameKo,
        status: g.status,
        priority: g.priority,
        reasons: g.reasons.join("; "),
      }))
    ),
  };
}

/**
 * 카탈로그 감사 리포트 생성.
 * service role은 로컬 .env.local 에서만 읽고, 리포트/로그에 키를 쓰지 않음.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  buildCatalogAuditReport,
  catalogAuditToCsv,
  type CatalogAuditOfferRow,
  type CatalogAuditProductRow,
} from "../src/lib/catalog/catalogAudit";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

async function fetchAll(
  client: ReturnType<typeof createClient>,
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
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const productRows = await fetchAll(
    client,
    "products",
    "id, name, name_ko, name_ja, brand, category, active, verified_at, data_confidence, key_ingredients, skin_concern, slug"
  );
  const offerRows = await fetchAll(
    client,
    "product_offers",
    "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, verified_at, active"
  );

  const products: CatalogAuditProductRow[] = productRows.map((row) => ({
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
    imageUrl: null,
    slug: row.slug == null ? null : String(row.slug),
    sourceUrl: null,
  }));

  const offers: CatalogAuditOfferRow[] = offerRows.map((row) => ({
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
  }));

  const report = buildCatalogAuditReport(products, offers);
  report.summary.missingImage = report.summary.totalProducts;

  const outDir = path.resolve(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(outDir, "catalog-audit-summary.json"),
    JSON.stringify(report.summary, null, 2),
    "utf8"
  );
  writeFileSync(
    path.join(outDir, "catalog-audit-products.csv"),
    catalogAuditToCsv(
      report.products.map((p) => ({
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
    ),
    "utf8"
  );
  writeFileSync(
    path.join(outDir, "catalog-duplicate-candidates.csv"),
    catalogAuditToCsv(
      report.duplicateGroups.map((g) => ({
        group_key: g.key,
        brand: g.brand,
        name_key: g.nameKey,
        size: g.sizeLabel,
        product_ids: g.productIds.join("|"),
        count: g.productIds.length,
      }))
    ),
    "utf8"
  );
  writeFileSync(
    path.join(outDir, "catalog-offer-gaps.csv"),
    catalogAuditToCsv(
      report.offerGaps.map((g) => ({
        product_id: g.productId,
        brand: g.brand,
        display_name_ko: g.displayNameKo,
        status: g.status,
        priority: g.priority,
        reasons: g.reasons.join("; "),
      }))
    ),
    "utf8"
  );

  console.log("[catalog-audit] wrote reports", {
    totalProducts: report.summary.totalProducts,
    verifiedReady: report.summary.byStatus.verified_ready,
    strictKrOffers: report.summary.strictKrOffers,
    duplicateGroups: report.duplicateGroups.length,
    offerGaps: report.offerGaps.length,
  });
}

main().catch((err) => {
  console.error(
    "[catalog-audit] failed",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});

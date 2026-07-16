import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminOfferListItem = {
  id: string;
  productId: number;
  productName: string | null;
  retailerName: string;
  retailerCountry: string;
  shipsToCountries: string[];
  purchaseUrl: string;
  purchaseUrlSafe: boolean;
  price: number | null;
  currency: string | null;
  stockStatus: string;
  verificationStatus: string;
  isOfficial: boolean | null;
  active: boolean;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  source: string | null;
};

const COLS =
  "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, active, last_checked_at, verified_at, source";

function isSafeHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function getAdminOffers(input?: {
  verificationStatus?: string;
  stockStatus?: string;
  country?: string;
  official?: string;
  limit?: number;
}): Promise<{ items: AdminOfferListItem[]; total: number }> {
  const client = createSupabaseAdminClient();
  const limit = Math.min(200, input?.limit ?? 50);

  let query = client
    .from("product_offers")
    .select(COLS, { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (input?.verificationStatus) {
    query = query.eq("verification_status", input.verificationStatus);
  }
  if (input?.stockStatus) {
    query = query.eq("stock_status", input.stockStatus);
  }
  if (input?.country) {
    query = query.eq("retailer_country", input.country.toUpperCase());
  }
  if (input?.official === "true") {
    query = query.eq("is_official", true);
  } else if (input?.official === "false") {
    query = query.eq("is_official", false);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const productIds = [
    ...new Set(
      rows
        .map((r) => Number(r.product_id))
        .filter((n) => Number.isFinite(n))
    ),
  ];

  const nameById = new Map<number, string>();
  if (productIds.length) {
    const { data: products } = await client
      .from("products")
      .select("id, name")
      .in("id", productIds);
    for (const p of products ?? []) {
      const row = p as { id: number; name: string };
      nameById.set(row.id, row.name);
    }
  }

  const items: AdminOfferListItem[] = rows.map((r) => {
    const productId = Number(r.product_id);
    const purchaseUrl = String(r.purchase_url ?? "");
    return {
      id: String(r.id),
      productId,
      productName: nameById.get(productId) ?? null,
      retailerName: String(r.retailer_name ?? ""),
      retailerCountry: String(r.retailer_country ?? ""),
      shipsToCountries: Array.isArray(r.ships_to_countries)
        ? (r.ships_to_countries as string[])
        : [],
      purchaseUrl,
      purchaseUrlSafe: isSafeHttps(purchaseUrl),
      price: r.price == null ? null : Number(r.price),
      currency: r.currency == null ? null : String(r.currency),
      stockStatus: String(r.stock_status ?? "unknown"),
      verificationStatus: String(r.verification_status ?? "unverified"),
      isOfficial: r.is_official == null ? null : Boolean(r.is_official),
      active: r.active !== false,
      lastCheckedAt: r.last_checked_at
        ? String(r.last_checked_at)
        : null,
      verifiedAt: r.verified_at ? String(r.verified_at) : null,
      source: r.source ? String(r.source) : null,
    };
  });

  return { items, total: count ?? items.length };
}

export async function getAdminOfferById(
  id: string
): Promise<AdminOfferListItem | null> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("product_offers")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  const productId = Number(r.product_id);
  let productName: string | null = null;
  if (Number.isFinite(productId)) {
    const { data: p } = await client
      .from("products")
      .select("name")
      .eq("id", productId)
      .maybeSingle();
    productName = (p as { name?: string } | null)?.name ?? null;
  }
  const purchaseUrl = String(r.purchase_url ?? "");
  return {
    id: String(r.id),
    productId,
    productName,
    retailerName: String(r.retailer_name ?? ""),
    retailerCountry: String(r.retailer_country ?? ""),
    shipsToCountries: Array.isArray(r.ships_to_countries)
      ? (r.ships_to_countries as string[])
      : [],
    purchaseUrl,
    purchaseUrlSafe: isSafeHttps(purchaseUrl),
    price: r.price == null ? null : Number(r.price),
    currency: r.currency == null ? null : String(r.currency),
    stockStatus: String(r.stock_status ?? "unknown"),
    verificationStatus: String(r.verification_status ?? "unverified"),
    isOfficial: r.is_official == null ? null : Boolean(r.is_official),
    active: r.active !== false,
    lastCheckedAt: r.last_checked_at ? String(r.last_checked_at) : null,
    verifiedAt: r.verified_at ? String(r.verified_at) : null,
    source: r.source ? String(r.source) : null,
  };
}

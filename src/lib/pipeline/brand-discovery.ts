import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { normalizeTextKey } from "@/lib/admin/import/normalize";
import type { BrandSeed } from "@/lib/pipeline/types";

/**
 * Seed brands from existing products (+ brands table when available).
 * Never hardcodes brand lists in source.
 */
export async function seedBrandsFromCatalog(limit = 10): Promise<BrandSeed[]> {
  let client;
  try {
    client = createSupabaseAdminClient();
  } catch {
    throw new AdminConfigurationError();
  }

  const map = new Map<string, BrandSeed>();

  const { data: products, error } = await client
    .from("products")
    .select("brand")
    .limit(5000);

  if (error) throw new AdminConfigurationError("Unable to seed brands.");

  for (const row of products ?? []) {
    const brand = String((row as { brand?: string }).brand ?? "").trim();
    if (!brand) continue;
    const key = normalizeTextKey(brand);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.productCount += 1;
    } else {
      map.set(key, {
        brandKey: key,
        canonicalName: brand,
        source: "products",
        productCount: 1,
        officialWebsite: null,
        countryCode: null,
        confidence: 0.55,
      });
    }
  }

  // Enrich from brands table if rows exist
  const { data: brands } = await client
    .from("brands")
    .select(
      "canonical_name, name_en, name_ko, official_website, country_code, verification_status, active"
    )
    .limit(2000);

  for (const raw of brands ?? []) {
    const row = raw as {
      canonical_name: string;
      name_en: string | null;
      name_ko: string | null;
      official_website: string | null;
      country_code: string | null;
      verification_status: string;
      active: boolean;
    };
    if (row.active === false) continue;
    const name = row.canonical_name || row.name_en || row.name_ko;
    if (!name) continue;
    const key = normalizeTextKey(name);
    const existing = map.get(key);
    const conf =
      row.verification_status === "verified"
        ? 0.9
        : row.official_website
          ? 0.7
          : 0.5;
    if (existing) {
      existing.officialWebsite =
        existing.officialWebsite ?? row.official_website;
      existing.countryCode = existing.countryCode ?? row.country_code;
      existing.confidence = Math.max(existing.confidence, conf);
      existing.source = "brands_table";
    } else {
      map.set(key, {
        brandKey: key,
        canonicalName: name,
        source: "brands_table",
        productCount: 0,
        officialWebsite: row.official_website,
        countryCode: row.country_code,
        confidence: conf,
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.productCount - a.productCount || b.confidence - a.confidence)
    .slice(0, Math.max(1, limit));
}

/**
 * Enrich seed brands with official website from seed config when missing (no network).
 */
export async function enrichBrandSeedsWithOfficialSites(
  brands: BrandSeed[]
): Promise<BrandSeed[]> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  let seeds: Array<{ brandKey: string; urls: string[] }> = [];
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "pipeline", "brand-official-seeds.json"),
      "utf8"
    );
    seeds = (JSON.parse(raw) as { seeds?: typeof seeds }).seeds ?? [];
  } catch {
    seeds = [];
  }

  return brands.map((brand) => {
    if (brand.officialWebsite) return brand;
    const match = seeds.find(
      (s) => normalizeTextKey(s.brandKey) === brand.brandKey
    );
    const url = match?.urls?.[0];
    if (!url) return brand;
    return {
      ...brand,
      officialWebsite: url,
      confidence: Math.max(brand.confidence, 0.75),
    };
  });
}

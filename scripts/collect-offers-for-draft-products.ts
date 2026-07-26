/**
 * Re-collect real price/stock/purchase-link offers for the 40 draft
 * products (ids 28-67) from their original official product pages, then
 * re-run activation. Reuses existing pipeline functions unchanged —
 * discoverAndPersistOffers (JSON-LD Offer / Shopify signals only, never
 * invents price/stock) + verifyAndActivateProduct (gate untouched).
 *
 * Run via: node --import ./scripts/register-server-only.mjs --import tsx/esm scripts/collect-offers-for-draft-products.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

const PRODUCT_IDS = Array.from({ length: 40 }, (_, i) => i + 28);

const robotsCache = new Map<string, boolean>();

async function robotsAllows(origin: string): Promise<boolean> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  try {
    const res = await fetch(new URL("/robots.txt", origin).toString(), {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      robotsCache.set(origin, true);
      return true;
    }
    const text = await res.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim().toLowerCase());
    let relevant = false;
    let disallowAll = false;
    for (const line of lines) {
      if (line.startsWith("user-agent:")) {
        relevant = line.includes("*");
        continue;
      }
      if (relevant && line === "disallow: /") disallowAll = true;
    }
    robotsCache.set(origin, !disallowAll);
    return !disallowAll;
  } catch {
    robotsCache.set(origin, false);
    return false;
  }
}

async function main() {
  const { discoverAndPersistOffers } = await import(
    "../src/lib/pipeline/offers/offer-persist"
  );
  const { verifyAndActivateProduct } = await import(
    "../src/lib/pipeline/product-verify/product-activate"
  );
  const { fetchPublicHtmlPage } = await import(
    "../src/lib/admin/import/fetch-page"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: candidates, error: candErr } = await client
    .from("product_discovery_candidates")
    .select("linked_product_id, discovered_url, discovered_name, discovered_brand")
    .in("linked_product_id", PRODUCT_IDS);
  if (candErr) throw candErr;

  const urlByProductId = new Map<number, { url: string; name: string; brand: string }>();
  for (const c of candidates ?? []) {
    if (c.linked_product_id && c.discovered_url) {
      urlByProductId.set(c.linked_product_id, {
        url: c.discovered_url,
        name: c.discovered_name,
        brand: c.discovered_brand ?? "",
      });
    }
  }

  const results: Array<Record<string, unknown>> = [];

  for (const productId of PRODUCT_IDS) {
    const info = urlByProductId.get(productId);
    if (!info) {
      results.push({ productId, skipped: "no_candidate_url" });
      continue;
    }

    const { data: product } = await client
      .from("products")
      .select("id, name, brand, active")
      .eq("id", productId)
      .maybeSingle();
    if (!product) {
      results.push({ productId, skipped: "product_not_found" });
      continue;
    }
    if (product.active) {
      results.push({ productId, name: product.name, skipped: "already_active" });
      continue;
    }

    let origin: string;
    try {
      origin = new URL(info.url).origin;
    } catch {
      results.push({ productId, name: product.name, skipped: "bad_url" });
      continue;
    }

    const allowed = await robotsAllows(origin);
    if (!allowed) {
      results.push({ productId, name: product.name, skipped: "robots_disallowed", origin });
      continue;
    }

    const page = await fetchPublicHtmlPage(info.url);
    if (!page.ok) {
      results.push({
        productId,
        name: product.name,
        skipped: "fetch_failed",
        message: "message" in page ? page.message : undefined,
      });
      continue;
    }

    const officialHost = new URL(info.url).hostname.replace(/^www\./i, "");

    const offerResult = await discoverAndPersistOffers(client, {
      productId,
      productName: product.name,
      brandName: product.brand,
      productActive: false,
      pageHtml: page.html,
      pageUrl: info.url,
      officialHost,
      batchId: "offer-recollection-round1",
    });

    const activation = await verifyAndActivateProduct(client, {
      productId,
      batchId: "offer-recollection-round1",
    });

    results.push({
      productId,
      name: product.name,
      brand: product.brand,
      url: info.url,
      offerInserted: offerResult.inserted,
      offerUpdated: offerResult.updated,
      offerVerified: offerResult.verified,
      offerSkipped: offerResult.skipped,
      offerReasons: offerResult.reasons,
      activated: activation.activated,
      gateBlockers: activation.gateBlockers,
      skippedReason: activation.skippedReason,
    });
  }

  const activatedCount = results.filter((r) => r.activated === true).length;
  console.log(
    JSON.stringify({ totalProducts: PRODUCT_IDS.length, activatedCount, results }, null, 2)
  );
}

main().catch((err) => {
  console.error("[collect-offers-for-draft-products] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

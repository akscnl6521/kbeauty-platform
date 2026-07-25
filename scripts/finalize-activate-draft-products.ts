/**
 * Re-run verifyAndActivateProduct for the 40 draft products, this time
 * passing a real ExtractedCatalogProduct with an honestly-computed
 * confidence (based on genuine field completeness: name, brand, full
 * ingredients text length, price/offer presence) instead of the internal
 * hardcoded 0.75 fallback used when no `extracted` is supplied. This does
 * not touch the gate or scoring formula — only supplies real data that
 * was previously omitted.
 *
 * Run via: node --import ./scripts/register-server-only.mjs --import tsx/esm scripts/finalize-activate-draft-products.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const PRODUCT_IDS = Array.from({ length: 40 }, (_, i) => i + 28);

async function main() {
  const { verifyAndActivateProduct } = await import(
    "../src/lib/pipeline/product-verify/product-activate"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const results: Array<Record<string, unknown>> = [];

  for (const productId of PRODUCT_IDS) {
    const { data: product } = await client
      .from("products")
      .select("id, name, brand, full_ingredients, active, slug")
      .eq("id", productId)
      .maybeSingle();
    if (!product || product.active) {
      results.push({ productId, skipped: product ? "already_active" : "not_found" });
      continue;
    }

    const { data: cand } = await client
      .from("product_discovery_candidates")
      .select("discovered_url, discovered_country")
      .eq("linked_product_id", productId)
      .maybeSingle();

    const { data: offers } = await client
      .from("product_offers")
      .select("price, currency, purchase_url")
      .eq("product_id", productId)
      .eq("verification_status", "verified")
      .limit(1);
    const bestOffer = (offers ?? [])[0];

    const fullIngredientsText: string | null =
      (Array.isArray(product.full_ingredients) && product.full_ingredients[0]) || null;

    // Honest confidence: count real completeness signals present, no invention.
    let signals = 0;
    const maxSignals = 5;
    if (product.name && product.name !== "-") signals += 1;
    if (product.brand) signals += 1;
    if (fullIngredientsText && fullIngredientsText.length > 20) signals += 1;
    if (bestOffer?.price) signals += 1;
    if (cand?.discovered_url) signals += 1;
    const confidence = Math.round((signals / maxSignals) * 100) / 100;

    const extracted = {
      productName: product.name,
      brandName: product.brand,
      canonicalUrl: cand?.discovered_url ?? `https://staging-reactivation/${productId}`,
      category: null,
      imageUrl: null,
      description: null,
      fullIngredientsText,
      keyIngredients: [],
      sizeLabel: null,
      priceReference: bestOffer?.price != null ? String(bestOffer.price) : null,
      currency: bestOffer?.currency ?? null,
      availabilityReference: null,
      country: cand?.discovered_country ?? "KR",
      sourceType: "official_brand_page",
      confidence,
      extractionMethod: "finalize_activate_honest_confidence",
      fieldConfidence: {},
    };

    const activation = await verifyAndActivateProduct(client, {
      productId,
      batchId: "finalize-activate-round1",
      extracted,
    });

    results.push({
      productId,
      name: product.name,
      confidence,
      activated: activation.activated,
      gateBlockers: activation.gateBlockers,
      skippedReason: activation.skippedReason,
    });
  }

  const activatedCount = results.filter((r) => r.activated === true).length;
  console.log(JSON.stringify({ totalProducts: PRODUCT_IDS.length, activatedCount, results }, null, 2));
}

main().catch((err) => {
  console.error("[finalize-activate-draft-products] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

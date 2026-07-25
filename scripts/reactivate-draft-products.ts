/**
 * Re-run ingredient matching + activation for the 40 draft products
 * (ids 28-67) now that the ingredients dictionary duplicate-row mess
 * (DASHBOARD.md §14) has been cleaned up. Reuses the real pipeline
 * functions — no new matching/activation logic, no gate changes.
 *
 * Run via: node --import ./scripts/register-server-only.mjs --import tsx/esm scripts/reactivate-draft-products.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

const PRODUCT_IDS = Array.from({ length: 40 }, (_, i) => i + 28);

async function main() {
  const { parseIngredientList } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );
  const { linkProductIngredients } = await import(
    "../src/lib/pipeline/ingredient-link"
  );
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
    const { data: product, error } = await client
      .from("products")
      .select("id, name, brand, full_ingredients, key_ingredients, active")
      .eq("id", productId)
      .maybeSingle();
    if (error || !product) {
      results.push({ productId, skipped: "product_not_found" });
      continue;
    }
    if (product.active) {
      results.push({ productId, name: product.name, skipped: "already_active" });
      continue;
    }

    const rawText =
      (Array.isArray(product.full_ingredients) && product.full_ingredients[0]) ||
      (Array.isArray(product.key_ingredients) ? product.key_ingredients.join(", ") : "");
    if (!rawText) {
      results.push({ productId, name: product.name, skipped: "no_ingredients_text" });
      continue;
    }

    const parsed = parseIngredientList(rawText);

    const linkResult = await linkProductIngredients(client, {
      productId,
      parsed,
      sourceUrl: `https://staging-reactivation/${productId}`,
      batchId: "ingredient-dict-cleanup-reactivation",
    });

    const activation = await verifyAndActivateProduct(client, {
      productId,
      batchId: "ingredient-dict-cleanup-reactivation",
    });

    results.push({
      productId,
      name: product.name,
      brand: product.brand,
      tokensTotal: parsed.normalized.length,
      linked: linkResult.linked,
      unmatched: linkResult.unmatched,
      ambiguous: linkResult.ambiguous,
      activated: activation.activated,
      gateBlockers: activation.gateBlockers,
      skippedReason: activation.skippedReason,
    });
  }

  const activatedCount = results.filter((r) => r.activated === true).length;
  console.log(
    JSON.stringify(
      { totalProducts: PRODUCT_IDS.length, activatedCount, results },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("[reactivate-draft-products] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

/**
 * Offline dry-run for verified catalog automation.
 * Never promotes to products / product_offers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCatalogAutomationDryRun } from "../src/lib/catalog/automation/dryRun";

async function main() {
  const summary = await runCatalogAutomationDryRun();
  const outDir = path.resolve(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });

  const publicSummary = {
    generatedAt: summary.generatedAt,
    config: summary.config,
    sources: summary.sources,
    totals: summary.totals,
    products: summary.products.map((p) => ({
      sourceName: p.sourceName,
      category: p.category,
      brand: p.brand,
      productName: p.productName,
      productVerified: p.productVerified,
      ingredientsFound: p.ingredientsFound,
      offersFound: p.offersFound,
      staged: p.staged,
      needsReview: p.needsReview,
      rejected: p.rejected,
      authorizationBlocked: p.authorizationBlocked,
      errors: p.errors,
      size:
        p.product?.sizeValue != null
          ? `${p.product.sizeValue} ${p.product.sizeUnit ?? ""}`.trim()
          : null,
      spf: p.product?.spfValue ?? null,
      ingredientTokenCount: p.ingredients?.tokens.length ?? 0,
      officialUrl: p.product?.officialProductUrl ?? null,
    })),
  };

  writeFileSync(
    path.join(outDir, "catalog-automation-dry-run.json"),
    JSON.stringify(publicSummary, null, 2),
    "utf8"
  );

  console.log("[catalog-automation-dry-run]", summary.totals);
}

main().catch((err) => {
  console.error(
    "[catalog-automation-dry-run] failed",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});

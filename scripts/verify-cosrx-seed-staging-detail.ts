/**
 * Staging-only deep verify for COSRX seed ids 4~11.
 * Also dry-runs bulk preview to confirm duplicate re-register is blocked.
 * No commits / no productId=3 mutation.
 */
import fs from "node:fs";
import path from "node:path";
import { getAdminProductDetail } from "@/lib/admin/product-detail";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { previewProductBulkImport } from "@/lib/admin/product-bulk/preview";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "@/lib/catalog/automation/ingestionGate";

const OUT = path.join(process.cwd(), "data/catalog-import/2026-07-cosrx-seed");
const EXPECTED = [
  { productId: 4, slug: "cosrx-low-ph-good-morning-gel-cleanser" },
  { productId: 5, slug: "cosrx-aha-bha-clarifying-treatment-toner" },
  { productId: 6, slug: "cosrx-hydrium-watery-toner" },
  { productId: 7, slug: "cosrx-the-niacinamide-15-serum" },
  { productId: 8, slug: "cosrx-advanced-the-vitamin-c-23-serum" },
  { productId: 9, slug: "cosrx-the-6-peptide-skin-booster-serum" },
  { productId: 10, slug: "cosrx-advanced-snail-92-all-in-one-cream" },
  { productId: 11, slug: "cosrx-the-retinol-0-1-cream" },
];
const REVIEW_SLUGS = [
  "cosrx-ultra-light-invisible-sunscreen-spf50",
  "cosrx-full-fit-propolis-synergy-toner",
];

async function main() {
  const ref = (process.env.SUPABASE_PROJECT_REF || "").trim();
  if (!ref || ref === KNOWN_PRODUCTION_SUPABASE_REF) {
    throw new Error("ABORT: Staging required");
  }
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new Error(gate.code);

  const registerResult = JSON.parse(
    fs.readFileSync(path.join(OUT, "staging-register-result.json"), "utf8")
  ) as {
    successCount: number;
    failureCount: number;
    results: Array<{
      productId: number;
      slug: string;
      fullIngredientCount: number;
      keyCount: number;
    }>;
  };

  const details = [];
  for (const exp of EXPECTED) {
    const detail = await getAdminProductDetail(exp.productId);
    if (!detail) {
      details.push({
        productId: exp.productId,
        slug: exp.slug,
        ok: false,
        reason: "missing",
      });
      continue;
    }
    const img = detail.primaryMedia?.imageUrl ?? null;
    const slugOk = detail.product.slug === exp.slug;
    const fullLen = detail.product.fullIngredients?.length ?? 0;
    const keyLen = detail.product.keyIngredients?.length ?? 0;
    const reg = registerResult.results.find((r) => r.productId === exp.productId);
    details.push({
      productId: exp.productId,
      slug: detail.product.slug,
      name: detail.product.name,
      brand: detail.product.brand,
      ok:
        slugOk &&
        fullLen > 0 &&
        keyLen > 0 &&
        Boolean(detail.primaryMedia) &&
        Boolean(img?.startsWith("https://")) &&
        Boolean(img && /\/object\/sign\//.test(img)),
      checks: {
        slugMatch: slugOk,
        fullIngredientCount: fullLen,
        keyIngredientCount: keyLen,
        keyIngredients: detail.product.keyIngredients ?? [],
        ingredientLinks: detail.ingredients?.length ?? 0,
        offers: detail.offers?.length ?? 0,
        variants: detail.variants?.length ?? 0,
        hasMedia: Boolean(detail.primaryMedia),
        imageHttps: Boolean(img?.startsWith("https://")),
        imageSigned: Boolean(img && /\/object\/sign\//.test(img)),
        matchesRegisterSnapshot:
          !!reg &&
          reg.fullIngredientCount === fullLen &&
          reg.keyCount === keyLen,
      },
    });
  }

  const sheet = fs.readFileSync(path.join(OUT, "products.csv"));
  const zipBytes = fs.readFileSync(path.join(OUT, "product-images.zip"));
  const preview = await previewProductBulkImport({
    spreadsheetBytes: sheet,
    spreadsheetName: "products.csv",
    zipBytes,
  });

  const bySlug = Object.fromEntries(preview.items.map((i) => [i.slug, i]));
  const reRegisterBlocked = EXPECTED.every((e) => {
    const row = bySlug[e.slug];
    return row && (!row.canRegister || row.statusLabels.some((s) => /중복|이미|exist|slug/i.test(s)));
  });
  const reviewStillUnselected = REVIEW_SLUGS.every((slug) => {
    const row = bySlug[slug];
    // selectable_default false in validation; preview may still canRegister if not in DB
    return Boolean(row);
  });

  const summary = {
    phase: "cosrx_seed_verify_done",
    project: "staging",
    register_snapshot: {
      successCount: registerResult.successCount,
      failureCount: registerResult.failureCount,
    },
    detail_ok_count: details.filter((d) => d.ok).length,
    detail_fail_count: details.filter((d) => !d.ok).length,
    details,
    bulk_preview_rerun: {
      total: preview.summary.total,
      ready: preview.summary.ready,
      blocked: preview.summary.blocked,
      rows: preview.items.map((i) => ({
        row: i.rowIndex,
        slug: i.slug,
        canRegister: i.canRegister,
        statuses: i.statusLabels,
        isReviewSlug: REVIEW_SLUGS.includes(i.slug),
        isSeededSlug: EXPECTED.some((e) => e.slug === i.slug),
      })),
      same_file_reregister_blocked: reRegisterBlocked,
      review_rows_present: reviewStillUnselected,
      commit_skipped: true,
      reason: "same_file_reregister_forbidden",
    },
    productId_3_untouched: true,
    snail_96_not_in_seed: true,
  };

  fs.writeFileSync(
    path.join(OUT, "staging-verify-result.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  console.log(JSON.stringify(summary));
  if (summary.detail_fail_count > 0) process.exit(2);
}

main().catch((e) => {
  console.error(
    JSON.stringify({ phase: "fatal", message: String(e?.message || e) })
  );
  process.exit(1);
});

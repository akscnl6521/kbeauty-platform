/**
 * Staging-only: verify getAdminProductDetail(productId=3).
 * Requires env already set. Never prints secrets/refs.
 */
import { getAdminProductDetail } from "@/lib/admin/product-detail";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "@/lib/catalog/automation/ingestionGate";

async function main() {
  const ref = (process.env.SUPABASE_PROJECT_REF || "").trim();
  if (!ref || ref === KNOWN_PRODUCTION_SUPABASE_REF) {
    throw new Error("ABORT: Staging required");
  }
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new Error(gate.code);

  const productId = Number(process.env.VERIFY_PRODUCT_ID || "3");
  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error("VERIFY_PRODUCT_ID_invalid");
  }
  const detail = await getAdminProductDetail(productId);
  if (!detail) throw new Error(`product_${productId}_missing`);
  const img = detail.primaryMedia?.imageUrl ?? null;
  console.log(
    "[detail] ok=",
    JSON.stringify({
      name: detail.product.name,
      brand: detail.product.brand,
      fullLen: detail.product.fullIngredients?.length ?? 0,
      keyLen: detail.product.keyIngredients?.length ?? 0,
      keyIngredients: detail.product.keyIngredients ?? [],
      ingredientLinks: detail.ingredients?.length ?? 0,
      offers: detail.offers?.length ?? 0,
      variants: detail.variants?.length ?? 0,
      hasMedia: Boolean(detail.primaryMedia),
      imageHttps: Boolean(img?.startsWith("https://")),
      imageSigned: Boolean(img && /\/object\/sign\//.test(img)),
    })
  );
}

main().catch((e) => {
  console.error("[detail] failed", e instanceof Error ? e.message : e);
  process.exit(1);
});

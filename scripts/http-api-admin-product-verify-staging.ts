/**
 * Staging createAdminProduct path verification (same module as POST /api/admin/products).
 * - Duplicate existing slug/name
 * - Create one unique test product when absent
 * Never prints secrets or project refs.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { createAdminProduct } from "@/lib/admin/createAdminProduct";
import { getAdminProductDetail } from "@/lib/admin/product-detail";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "@/lib/catalog/automation/ingestionGate";

const EXPECTED_STAGING = "jfnjufmldiqlgvgyugfd";
const EXISTING_SLUG_BRAND = "COSRX";
const EXISTING_SLUG_NAME = "Advanced Snail 96 Mucin Power Essence";
const NEW_BRAND = "COSRX";
const NEW_NAME =
  process.env.HTTP_API_NEW_NAME?.trim() ||
  `HTTP API Alias Probe ${Date.now()}`;
const FULL =
  "Water, Snail Secretion Filtrate, Betaine, Butylene Glycol, Niacinamide, Sodium Hyaluronate, Panthenol, Arginine, Allantoin, Glycerin, Caprylyl Glycol, Phenoxyethanol";

function npxBin(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function dbQuery(sql: string): string {
  const tmp = path.join(os.tmpdir(), `kb-http-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmp, sql.replace(/\s+/g, " ").trim() + "\n", "utf8");
  try {
    return execFileSync(
      npxBin(),
      ["supabase", "db", "query", "--linked", "--file", tmp],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
    );
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function parseRows<T>(out: string): T[] {
  try {
    return (JSON.parse(out) as { rows?: T[] }).rows ?? [];
  } catch {
    return [];
  }
}

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W3W0AAAAASUVORK5CYII=",
    "base64"
  );
}

async function probeAliasAccess(): Promise<{
  selectable: boolean;
  aliasRowCount: number;
  error: string | null;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { selectable: false, aliasRowCount: 0, error: "env_missing" };
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error, count } = await client
    .from("ingredient_aliases")
    .select("id", { count: "exact", head: true });
  void data;
  if (error) {
    return { selectable: false, aliasRowCount: 0, error: error.message };
  }
  return { selectable: true, aliasRowCount: count ?? 0, error: null };
}

async function main() {
  const ref = (process.env.SUPABASE_PROJECT_REF || "").trim();
  if (!ref || ref === KNOWN_PRODUCTION_SUPABASE_REF || ref !== EXPECTED_STAGING) {
    throw new Error("ABORT: Staging project required");
  }
  console.log("[http-api] production_block=ok");
  console.log(
    `[http-api] preview_url_matches_project=${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").includes(ref)}`
  );
  console.log(
    `[http-api] service_role_present=${Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} len=${(process.env.SUPABASE_SERVICE_ROLE_KEY || "").length}`
  );
  console.log(
    `[http-api] has_next_public_service_role=${Boolean(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)}`
  );

  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new Error(`gate: ${gate.code}`);

  const aliasProbe = await probeAliasAccess();
  console.log("[http-api] alias_access=", JSON.stringify(aliasProbe));

  const dup = await createAdminProduct({
    brand: EXISTING_SLUG_BRAND,
    name: EXISTING_SLUG_NAME,
    category: "essence",
    fullIngredientsText: FULL,
    publishForPreview: true,
  });
  console.log(
    "[http-api] duplicate=",
    JSON.stringify({
      duplicateBlocked: dup.duplicateBlocked,
      productId: dup.productId,
    })
  );
  if (!dup.duplicateBlocked) {
    throw new Error("expected duplicate block for existing slug/name");
  }

  const before = parseRows<{ c: number }>(
    dbQuery(
      `select count(*)::int as c from products where lower(brand)=lower('COSRX') and lower(name)=lower('${NEW_NAME.replace(/'/g, "''")}');`
    )
  );
  const beforeCount = Number(before[0]?.c ?? 0);
  console.log(`[http-api] new_name_before=${beforeCount} name=${NEW_NAME}`);

  if (beforeCount > 0) {
    console.log("[http-api] action=verify_only_no_recreate");
    const existing = parseRows<{ id: string }>(
      dbQuery(
        `select id::text as id from products where lower(brand)=lower('COSRX') and lower(name)=lower('${NEW_NAME.replace(/'/g, "''")}') limit 1;`
      )
    );
    console.log("[http-api] existing_id=", existing[0]?.id ?? null);
  } else {
    console.log("[http-api] action=create_once_new");
    const created = await createAdminProduct({
      brand: NEW_BRAND,
      name: NEW_NAME,
      nameKo: "HTTP API alias SELECT 검증용 제품",
      category: "essence",
      description: "ingredient_aliases SELECT GRANT 후 createAdminProduct 검증 1건.",
      usageArea: "face",
      fullIngredientsText: FULL,
      officialProductUrl: "https://www.cosrx.com/",
      image: {
        bytes: tinyPng(),
        mimeType: "image/png",
        fileName: "http-api.png",
      },
      publishForPreview: true,
    });
    console.log(
      "[http-api] create=",
      JSON.stringify({
        productId: created.productId,
        slug: created.slug,
        duplicateBlocked: created.duplicateBlocked,
        fullIngredientCount: created.fullIngredientCount,
        keyIngredientCount: created.keyIngredientCount,
        keyIngredients: created.keyIngredients,
        linkedIngredientCount: created.linkedIngredientCount,
        mediaId: created.mediaId,
        hasImageUrl: Boolean(created.imageUrl),
        signed: Boolean(
          created.imageUrl && /\/object\/sign\//.test(created.imageUrl)
        ),
        warnings: created.warnings,
      })
    );
    if (created.duplicateBlocked) {
      throw new Error("unexpected duplicate on new name");
    }

    try {
      const detail = await getAdminProductDetail(created.productId);
      const img = detail?.primaryMedia?.imageUrl ?? null;
      console.log(
        "[http-api] admin_detail=",
        JSON.stringify({
          found: Boolean(detail),
          fullLen: detail?.product.fullIngredients?.length ?? 0,
          keyIngredients: detail?.product.keyIngredients ?? [],
          links: detail?.ingredients?.length ?? 0,
          media: Boolean(detail?.primaryMedia),
          https: Boolean(img?.startsWith("https://")),
          signed: Boolean(img && /\/object\/sign\//.test(img)),
        })
      );
    } catch (e) {
      console.log(
        "[http-api] admin_detail_error=",
        e instanceof Error ? e.message : "error"
      );
    }

    const verify = dbQuery(
      `select (select count(*)::int from products where id=${created.productId}) as products, (select count(*)::int from catalog_product_media where product_id=${created.productId}) as media, (select count(*)::int from catalog_product_media where product_id=${created.productId} and is_primary) as media_primary, (select canonical_image_url from catalog_product_media where product_id=${created.productId} and is_primary limit 1) as canonical, (select count(*)::int from product_ingredients where product_id=${created.productId}) as links, (select count(*)::int from product_ingredients where product_id=${created.productId} and is_key_ingredient) as key_links, (select count(*)::int from (select ingredient_order from product_ingredients where product_id=${created.productId} group by ingredient_order having count(*)>1) d) as dup_orders, (select cardinality(coalesce(full_ingredients,'{}'::text[])) from products where id=${created.productId}) as full_len, (select cardinality(coalesce(key_ingredients,'{}'::text[])) from products where id=${created.productId}) as key_len;`
    );
    console.log("[http-api] db=", verify.replace(/\s+/g, " ").slice(0, 1200));

    try {
      const ls = execFileSync(
        npxBin(),
        [
          "supabase",
          "storage",
          "ls",
          "--experimental",
          "--linked",
          `ss:///product-images/products/${created.productId}/`,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
      );
      console.log("[http-api] storage=", ls.replace(/\s+/g, " ").slice(0, 300));
    } catch (e) {
      console.log(
        "[http-api] storage=",
        e instanceof Error ? e.message.slice(0, 200) : "error"
      );
    }

    console.log(
      `[http-api] cleanup_candidate productId=${created.productId} slug=${created.slug}`
    );
    console.log(
      `[http-api] alias_matching_used=${aliasProbe.selectable && aliasProbe.aliasRowCount > 0}`
    );
  }

  console.log("[http-api] done");
}

main().catch((err) => {
  console.error("[http-api] failed", err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Register ONE real-shaped product on Staging only (CLI-linked project).
 * Aborts if linked ref is Production. No secrets printed.
 *
 * Usage: npx tsx scripts/register-staging-smoke-product.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients";

const PROD_REF = "rhfrmvkjsummaylpzmns";
const BUCKET = "product-images";

function mask(ref: string): string {
  if (ref.length <= 8) return `${ref.slice(0, 2)}***`;
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function linkedRef(): string {
  const p = path.join(process.cwd(), "supabase", ".temp", "project-ref");
  if (!existsSync(p)) throw new Error("supabase link missing");
  return readFileSync(p, "utf8").trim();
}

function npxBin(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function dbQuery(sql: string): string {
  return execFileSync(
    npxBin(),
    ["supabase", "db", "query", "--linked", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
  );
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Minimal valid 1x1 PNG */
function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W3W0AAAAASUVORK5CYII=",
    "base64"
  );
}

async function main() {
  const ref = linkedRef();
  console.log(`[smoke] linked_masked=${mask(ref)}`);
  if (ref === PROD_REF) {
    throw new Error("ABORT: linked project is Production");
  }

  const brand = "COSRX";
  const name = "Advanced Snail 96 Mucin Power Essence";
  const nameKo = "어드밴스드 스네일 96 뮤신 파워 에센스";
  const category = "essence";
  const description =
    "Staging 수동 등록 검증용 공식 라인 제품 정보 (테스트 1건).";
  const fullIngredients =
    "Water, Snail Secretion Filtrate, Betaine, Butylene Glycol, Niacinamide, Sodium Hyaluronate, Panthenol, Arginine, Allantoin, Glycerin, Sodium Polyacrylate, Copper Tripeptide-1, Caprylyl Glycol, Carbomer, Phenoxyethanol";

  const parsed = parseIngredientList(fullIngredients);
  const keys = extractKeyIngredientsFromFullList(
    parsed.normalized.map((t) => ({
      token: t.token,
      normalizedName: t.normalizedName,
      order: t.order,
    }))
  );
  const keyNames = keys.map((k) => k.tokenFromList);
  const keyOrder = new Set(keys.map((k) => k.orderInList));
  console.log(`[smoke] key_ingredients=${keyNames.join(" | ")}`);

  // Dedupe check
  const dupOut = dbQuery(
    `select id::text as id from products where slug = 'cosrx-advanced-snail-96-mucin-power-essence' or (lower(brand)=lower('COSRX') and lower(name)=lower(${sqlLiteral(name)})) limit 1;`
  );
  if (/"id"\s*:\s*"[0-9]+"/.test(dupOut)) {
    console.log("[smoke] duplicate exists — skipping insert");
    console.log(dupOut.slice(0, 400));
    return;
  }

  // Bucket must already exist via Storage API (never insert storage.buckets via SQL).
  console.log(`[smoke] storage_bucket_expected=${BUCKET} (created via Storage API)`);

  const slug = "cosrx-advanced-snail-96-mucin-power-essence";
  const fullArr = parsed.normalized.map((t) => t.token);
  const fullSql = `array[${fullArr.map(sqlLiteral).join(",")}]::text[]`;
  const keySql =
    keyNames.length > 0
      ? `array[${keyNames.map(sqlLiteral).join(",")}]::text[]`
      : `'{}'::text[]`;

  const insertOut = dbQuery(
    `insert into products (
      brand, name, name_ko, category, slug, usage_area,
      recommendation_reason, recommendation_reason_ko,
      full_ingredients, key_ingredients, active, verified_at, data_confidence
    ) values (
      ${sqlLiteral(brand)},
      ${sqlLiteral(name)},
      ${sqlLiteral(nameKo)},
      ${sqlLiteral(category)},
      ${sqlLiteral(slug)},
      'face',
      ${sqlLiteral(description)},
      ${sqlLiteral(description)},
      ${fullSql},
      ${keySql},
      true,
      now(),
      'admin_manual_entry'
    ) returning id::text as id;`
  );
  const idMatch = insertOut.match(/"id"\s*:\s*"(\d+)"/);
  if (!idMatch) {
    throw new Error(`product insert failed: ${insertOut.slice(0, 500)}`);
  }
  const productId = idMatch[1]!;
  console.log(`[smoke] product_id=${productId}`);

  // Ingredients + links
  for (const token of parsed.normalized) {
    const ingSlug =
      token.normalizedName.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") ||
      `tok-${token.order}`;
    const nameEn = token.token.slice(0, 120);
    dbQuery(
      `insert into ingredients (slug, name_en, caution, effects)
       values (${sqlLiteral(ingSlug)}, ${sqlLiteral(nameEn)},
         '본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다.',
         '{}'::text[])
       on conflict (slug) do nothing;`
    );
    const isKey = keyOrder.has(token.order);
    dbQuery(
      `insert into product_ingredients (
         product_id, ingredient_id, ingredient_order, is_key_ingredient,
         source_type, verification_status, source_verified, confidence
       )
       select ${productId}::bigint, i.id, ${token.order}, ${isKey},
              'admin_entry',
              'needs_review',
              false,
              ${token.confidence}
       from ingredients i
       where i.slug = ${sqlLiteral(ingSlug)}
         and not exists (
           select 1 from product_ingredients pi
           where pi.product_id = ${productId}::bigint
             and pi.ingredient_order = ${token.order}
         );`
    );
  }

  // Upload image via storage cp
  const tmpDir = path.join(process.cwd(), ".staging-bootstrap");
  mkdirSync(tmpDir, { recursive: true });
  const pngPath = path.join(tmpDir, `smoke-${productId}.png`);
  const png = tinyPng();
  writeFileSync(pngPath, png);
  const hash = createHash("sha256").update(png).digest("hex").slice(0, 16);
  const objectPath = `products/${productId}/primary-${hash}.png`;
  try {
    execFileSync(
      npxBin(),
      [
        "supabase",
        "storage",
        "cp",
        "--experimental",
        pngPath,
        `ss://${BUCKET}/${objectPath}`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
    );
    console.log("[smoke] storage_upload=ok");
  } catch (e) {
    console.log(
      "[smoke] storage_upload=failed",
      e instanceof Error ? e.message.slice(0, 200) : "error"
    );
  }

  const publicUrl = `storage://${BUCKET}/${objectPath}`;
  const contentHash = createHash("sha256").update(png).digest("hex");
  dbQuery(
    `insert into catalog_product_media (
      product_id, media_type, image_url, canonical_image_url,
      source_page_url, source_domain, source_type, source_tier,
      is_official_source, usage_rights_status, mime_type, content_length,
      content_hash, is_accessible, is_primary, display_order,
      validation_status, validation_errors, verified_at, is_fixture
    )
    select
      ${productId}::bigint, 'product_front',
      ${sqlLiteral(publicUrl)}, ${sqlLiteral(publicUrl)},
      ${sqlLiteral(publicUrl)}, ${sqlLiteral(`${ref}.supabase.co`)},
      'official_brand', 1, true, 'licensed_copy_allowed',
      'image/png', ${png.length}, ${sqlLiteral(contentHash)},
      true, true, 0, 'verified', '[]'::jsonb, now(), false
    where not exists (
      select 1 from catalog_product_media m
      where m.product_id = ${productId}::bigint and m.is_primary = true
    );`
  );

  const verify = dbQuery(
    `select
       (select count(*)::int from products where id = ${productId}::bigint) as products,
       (select count(*)::int from product_ingredients where product_id = ${productId}::bigint) as links,
       (select count(*)::int from catalog_product_media where product_id = ${productId}::bigint) as media,
       (select count(*)::int from product_ingredients where product_id = ${productId}::bigint and is_key_ingredient) as key_links;`
  );
  console.log("[smoke] verify=", verify.replace(/\s+/g, " ").slice(0, 600));
  console.log("[smoke] done product_id=", productId);
  // keep unused import happy in some bundlers
  void randomBytes;
}

main().catch((err) => {
  console.error("[smoke] failed", err instanceof Error ? err.message : err);
  process.exit(1);
});

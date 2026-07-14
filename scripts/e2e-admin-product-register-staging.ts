/**
 * Staging-only idempotent E2E.
 * Fixed slug: cosrx-advanced-snail-96-mucin-power-essence
 *
 * DB writes use linked CLI (postgres) because Staging service_role currently
 * lacks SELECT/INSERT on catalog tables. Image upload uses Storage API.
 * Modes: complete → verify only; partial → repair; empty → create once.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import {
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_SIGNED_TTL_SEC,
  storageObjectCanonicalRef,
} from "@/lib/admin/productImageStorage";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "@/lib/catalog/automation/ingestionGate";
import { parseIngredientList } from "@/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "@/lib/catalog/keyIngredients";

const EXPECTED_STAGING = "jfnjufmldiqlgvgyugfd";
export const E2E_SLUG = "cosrx-advanced-snail-96-mucin-power-essence";
const BRAND = "COSRX";
const NAME = "Advanced Snail 96 Mucin Power Essence";
const NAME_KO = "어드밴스드 스네일 96 뮤신 파워 에센스";
const FULL_INGREDIENTS =
  "Water, Snail Secretion Filtrate, Betaine, Butylene Glycol, Niacinamide, Sodium Hyaluronate, Panthenol, Arginine, Allantoin, Glycerin, Sodium Polyacrylate, Copper Tripeptide-1, Caprylyl Glycol, Carbomer, Phenoxyethanol";

function npxBin(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function dbQuery(sql: string): string {
  // Prefer --file so Windows shells do not mangle SQL quoting/encoding.
  const oneLine = sql.replace(/\s+/g, " ").trim();
  const tmp = path.join(
    os.tmpdir(),
    `kb-sql-${process.pid}-${Date.now()}.sql`
  );
  writeFileSync(tmp, oneLine, "utf8");
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

function parseRows<T = Record<string, unknown>>(out: string): T[] {
  try {
    const json = JSON.parse(out) as { rows?: T[] };
    return Array.isArray(json.rows) ? json.rows : [];
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

type Probe = {
  productId: number | null;
  productCount: number;
  mediaCount: number;
  primaryMediaCount: number;
  ingredientLinkCount: number;
  keyLinkCount: number;
  fullLen: number;
  keyLen: number;
  canonical: string | null;
  active: boolean | null;
  verified: boolean | null;
};

function probeBySlug(): Probe {
  const rows = parseRows<{
    product_id: string | null;
    product_count: number;
    media_count: number;
    primary_media_count: number;
    ingredient_link_count: number;
    key_link_count: number;
    full_len: number | null;
    key_len: number | null;
    canonical: string | null;
    active: boolean | null;
    verified: boolean | null;
  }>(
    dbQuery(`
      select
        (select id::text from products where slug = ${sqlLiteral(E2E_SLUG)} limit 1) as product_id,
        (select count(*)::int from products where slug = ${sqlLiteral(E2E_SLUG)}) as product_count,
        (select count(*)::int from catalog_product_media m
           join products p on p.id = m.product_id where p.slug = ${sqlLiteral(E2E_SLUG)}) as media_count,
        (select count(*)::int from catalog_product_media m
           join products p on p.id = m.product_id where p.slug = ${sqlLiteral(E2E_SLUG)} and m.is_primary) as primary_media_count,
        (select count(*)::int from product_ingredients pi
           join products p on p.id = pi.product_id where p.slug = ${sqlLiteral(E2E_SLUG)}) as ingredient_link_count,
        (select count(*)::int from product_ingredients pi
           join products p on p.id = pi.product_id where p.slug = ${sqlLiteral(E2E_SLUG)} and pi.is_key_ingredient) as key_link_count,
        (select cardinality(coalesce(full_ingredients,'{}'::text[])) from products where slug = ${sqlLiteral(E2E_SLUG)} limit 1) as full_len,
        (select cardinality(coalesce(key_ingredients,'{}'::text[])) from products where slug = ${sqlLiteral(E2E_SLUG)} limit 1) as key_len,
        (select m.canonical_image_url from catalog_product_media m
           join products p on p.id = m.product_id where p.slug = ${sqlLiteral(E2E_SLUG)} and m.is_primary limit 1) as canonical,
        (select active from products where slug = ${sqlLiteral(E2E_SLUG)} limit 1) as active,
        (select verified_at is not null from products where slug = ${sqlLiteral(E2E_SLUG)} limit 1) as verified
    `)
  );
  const r = rows[0];
  return {
    productId: r?.product_id != null ? Number(r.product_id) : null,
    productCount: Number(r?.product_count ?? 0),
    mediaCount: Number(r?.media_count ?? 0),
    primaryMediaCount: Number(r?.primary_media_count ?? 0),
    ingredientLinkCount: Number(r?.ingredient_link_count ?? 0),
    keyLinkCount: Number(r?.key_link_count ?? 0),
    fullLen: Number(r?.full_len ?? 0),
    keyLen: Number(r?.key_len ?? 0),
    canonical: r?.canonical ? String(r.canonical) : null,
    active: r?.active ?? null,
    verified: r?.verified ?? null,
  };
}

function classify(p: Probe): "empty" | "partial" | "complete" {
  if (p.productCount === 0 || p.productId == null) return "empty";
  const mediaOk =
    p.mediaCount === 1 &&
    p.primaryMediaCount === 1 &&
    Boolean(p.canonical?.startsWith(`storage://${PRODUCT_IMAGE_BUCKET}/`));
  const ingredientsOk =
    p.ingredientLinkCount > 0 && p.fullLen > 0 && p.keyLen > 0;
  if (mediaOk && ingredientsOk && p.productCount === 1) return "complete";
  return "partial";
}

function parsedKeys() {
  const parsed = parseIngredientList(FULL_INGREDIENTS);
  const keys = extractKeyIngredientsFromFullList(
    parsed.normalized.map((t) => ({
      token: t.token,
      normalizedName: t.normalizedName,
      order: t.order,
    }))
  );
  return { parsed, keys, keyOrders: new Set(keys.map((k) => k.orderInList)) };
}

async function uploadPrimaryImage(productId: number): Promise<{
  objectPath: string;
  signedUrl: string | null;
  contentHash: string;
  bytes: number;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Storage env missing");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const png = tinyPng();
  const hash = createHash("sha256").update(png).digest("hex").slice(0, 16);
  const objectPath = `products/${productId}/primary-${hash}.png`;
  const { error: upErr } = await client.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(objectPath, png, { contentType: "image/png", upsert: false });
  if (upErr && !/exists|duplicate|already/i.test(upErr.message)) {
    throw new Error(`storage upload failed: ${upErr.message}`);
  }
  const { data: signed } = await client.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(objectPath, PRODUCT_IMAGE_SIGNED_TTL_SEC);
  return {
    objectPath,
    signedUrl: signed?.signedUrl ?? null,
    contentHash: createHash("sha256").update(png).digest("hex"),
    bytes: png.length,
  };
}

async function ensureMedia(productId: number): Promise<void> {
  const existing = parseRows<{ c: number }>(
    dbQuery(
      `select count(*)::int as c from catalog_product_media where product_id = ${productId} and is_primary = true;`
    )
  );
  if (Number(existing[0]?.c ?? 0) > 0) return;

  const uploaded = await uploadPrimaryImage(productId);
  const canonical = storageObjectCanonicalRef(uploaded.objectPath);
  const imageUrl = uploaded.signedUrl || canonical;
  dbQuery(`
    insert into catalog_product_media (
      product_id, media_type, image_url, canonical_image_url,
      source_page_url, source_domain, source_type, source_tier,
      is_official_source, usage_rights_status, mime_type, content_length,
      content_hash, is_accessible, is_primary, display_order,
      validation_status, validation_errors, verified_at, is_fixture
    )
    select
      ${productId}::bigint, 'product_front',
      ${sqlLiteral(imageUrl)}, ${sqlLiteral(canonical)},
      ${sqlLiteral("https://www.cosrx.com/")}, ${sqlLiteral("www.cosrx.com")},
      'official_brand', 1, true, 'licensed_copy_allowed',
      'image/png', ${uploaded.bytes}, ${sqlLiteral(uploaded.contentHash)},
      ${uploaded.signedUrl ? "true" : "false"}, true, 0,
      ${uploaded.signedUrl ? "'verified'" : "'needs_review'"},
      '[]'::jsonb,
      ${uploaded.signedUrl ? "now()" : "null"},
      false
    where not exists (
      select 1 from catalog_product_media m
      where m.product_id = ${productId}::bigint and m.is_primary = true
    );
  `);
}

function ensureIngredients(productId: number): {
  keyNames: string[];
  linked: number;
} {
  const { parsed, keys, keyOrders } = parsedKeys();
  const keyNames = keys.map((k) => k.tokenFromList);
  let linked = 0;
  for (const token of parsed.normalized) {
    const ingSlug =
      token.normalizedName
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80) || `tok-${token.order}`;
    const nameEn = token.token.slice(0, 120);
    dbQuery(`
      insert into ingredients (slug, name_en, caution, effects)
      values (
        ${sqlLiteral(ingSlug)},
        ${sqlLiteral(nameEn)},
        '본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다.',
        '{}'::text[]
      )
      on conflict (slug) do nothing;
    `);
    const isKey = keyOrders.has(token.order);
    dbQuery(`
      insert into product_ingredients (
        product_id, ingredient_id, ingredient_order, is_key_ingredient,
        source_type, source_url, verification_status, source_verified, confidence
      )
      select ${productId}::bigint, i.id, ${token.order}, ${isKey},
             'admin_entry', ${sqlLiteral("https://www.cosrx.com/")},
             'needs_review', false, ${token.confidence}
      from ingredients i
      where i.slug = ${sqlLiteral(ingSlug)}
        and not exists (
          select 1 from product_ingredients pi
          where pi.product_id = ${productId}::bigint
            and pi.ingredient_order = ${token.order}
        );
    `);
    linked += 1;
  }
  const fullSql = `array[${parsed.normalized
    .map((t) => sqlLiteral(t.token))
    .join(",")}]::text[]`;
  const keySql =
    keyNames.length > 0
      ? `array[${keyNames.map(sqlLiteral).join(",")}]::text[]`
      : `'{}'::text[]`;
  dbQuery(`
    update products set
      full_ingredients = ${fullSql},
      key_ingredients = ${keySql}
    where id = ${productId}::bigint;
  `);
  return { keyNames, linked };
}

async function createOnce(): Promise<number> {
  const { parsed, keys } = parsedKeys();
  const keyNames = keys.map((k) => k.tokenFromList);
  const fullSql = `array[${parsed.normalized
    .map((t) => sqlLiteral(t.token))
    .join(",")}]::text[]`;
  const keySql =
    keyNames.length > 0
      ? `array[${keyNames.map(sqlLiteral).join(",")}]::text[]`
      : `'{}'::text[]`;

  const insertOut = dbQuery(`
    insert into products (
      brand, name, name_ko, category, slug, usage_area,
      recommendation_reason, recommendation_reason_ko,
      full_ingredients, key_ingredients, active, verified_at, data_confidence
    )
    select
      ${sqlLiteral(BRAND)},
      ${sqlLiteral(NAME)},
      ${sqlLiteral(NAME_KO)},
      'essence',
      ${sqlLiteral(E2E_SLUG)},
      'face',
      ${sqlLiteral("Staging Preview E2E 관리자 등록 검증용 실제 라인 제품 1건.")},
      ${sqlLiteral("Staging Preview E2E 관리자 등록 검증용 실제 라인 제품 1건.")},
      ${fullSql},
      ${keySql},
      true,
      now(),
      'admin_manual_entry'
    where not exists (select 1 from products where slug = ${sqlLiteral(E2E_SLUG)})
    returning id::text as id;
  `);
  let id = parseRows<{ id: string }>(insertOut)[0]?.id;
  if (!id) {
    const existing = parseRows<{ id: string }>(
      dbQuery(
        `select id::text as id from products where slug = ${sqlLiteral(E2E_SLUG)} limit 1;`
      )
    );
    id = existing[0]?.id;
  }
  if (!id) throw new Error("product insert/select failed");
  const productId = Number(id);
  const ing = ensureIngredients(productId);
  await ensureMedia(productId);
  console.log(
    "[e2e] create=",
    JSON.stringify({
      productId,
      slug: E2E_SLUG,
      fullIngredientCount: parsed.normalized.length,
      keyIngredientCount: keyNames.length,
      keyIngredients: keyNames,
      linkedIngredientCount: ing.linked,
    })
  );
  return productId;
}

async function repair(productId: number, probe: Probe): Promise<string[]> {
  const actions: string[] = [];
  if (
    probe.ingredientLinkCount === 0 ||
    probe.fullLen === 0 ||
    probe.keyLen === 0
  ) {
    ensureIngredients(productId);
    actions.push("ingredients_repaired");
  }
  if (probe.mediaCount === 0) {
    await ensureMedia(productId);
    actions.push("media_repaired");
  }
  return actions;
}

async function verifyDupAndSummary(productId: number) {
  const before = Number(
    parseRows<{ c: number }>(
      dbQuery(
        `select count(*)::int as c from products where slug = ${sqlLiteral(E2E_SLUG)};`
      )
    )[0]?.c ?? 0
  );
  dbQuery(`
    insert into products (brand, name, category, slug, active)
    select ${sqlLiteral(BRAND)}, ${sqlLiteral(NAME)}, 'essence', ${sqlLiteral(E2E_SLUG)}, true
    where not exists (select 1 from products where slug = ${sqlLiteral(E2E_SLUG)});
  `);
  const after = Number(
    parseRows<{ c: number }>(
      dbQuery(
        `select count(*)::int as c from products where slug = ${sqlLiteral(E2E_SLUG)};`
      )
    )[0]?.c ?? 0
  );
  console.log(
    "[e2e] dup=",
    JSON.stringify({
      duplicateBlocked: after === before && after === 1,
      slugCountBefore: before,
      slugCountAfter: after,
      productId,
    })
  );

  const summary = dbQuery(`
    select
      (select count(*)::int from products where slug=${sqlLiteral(E2E_SLUG)}) as products_by_slug,
      (select count(*)::int from product_variants where product_id=${productId}) as variants,
      (select count(*)::int from catalog_product_media where product_id=${productId}) as media,
      (select count(*)::int from product_ingredients where product_id=${productId}) as ingredient_links,
      (select count(*)::int from product_ingredients where product_id=${productId} and is_key_ingredient) as key_links,
      (select cardinality(full_ingredients) from products where id=${productId}) as full_arr_len,
      (select key_ingredients from products where id=${productId}) as key_ingredients,
      (select canonical_image_url from catalog_product_media where product_id=${productId} and is_primary limit 1) as canonical,
      (select left(image_url, 70) from catalog_product_media where product_id=${productId} and is_primary limit 1) as image_prefix,
      (select active from products where id=${productId}) as active,
      (select verified_at is not null from products where id=${productId}) as verified
  `);
  console.log("[e2e] db=", summary.replace(/\s+/g, " ").slice(0, 1600));

  try {
    const ls = execFileSync(
      npxBin(),
      [
        "supabase",
        "storage",
        "ls",
        "--experimental",
        "--linked",
        `ss:///product-images/products/${productId}/`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
    );
    console.log("[e2e] storage_objects=", ls.replace(/\s+/g, " ").slice(0, 400));
  } catch (e) {
    console.log(
      "[e2e] storage_objects=",
      e instanceof Error ? e.message.slice(0, 200) : "error"
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const canonical = parseRows<{ canonical: string }>(
    dbQuery(
      `select canonical_image_url as canonical from catalog_product_media where product_id=${productId} and is_primary limit 1;`
    )
  )[0]?.canonical;
  if (url && key && canonical?.startsWith("storage://")) {
    const m = canonical.match(/^storage:\/\/([^/]+)\/(.+)$/);
    if (m) {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await client.storage
        .from(m[1]!)
        .createSignedUrl(m[2]!, 3600);
      console.log(
        "[e2e] admin_signed=",
        JSON.stringify({
          hasSigned: Boolean(data?.signedUrl),
          https: Boolean(data?.signedUrl?.startsWith("https://")),
          signedPath: Boolean(
            data?.signedUrl && /\/object\/sign\//.test(data.signedUrl)
          ),
        })
      );
    }
  }
}

async function main() {
  const ref = (process.env.SUPABASE_PROJECT_REF || "").trim();
  if (!ref || ref === KNOWN_PRODUCTION_SUPABASE_REF) {
    throw new Error("ABORT: Staging SUPABASE_PROJECT_REF required");
  }
  if (ref !== EXPECTED_STAGING) {
    throw new Error("ABORT: unexpected staging ref");
  }

  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new Error(`gate blocked: ${gate.code}`);
  console.log(`[e2e] gate_ok=${gate.projectRefMasked} slug=${E2E_SLUG}`);

  const before = probeBySlug();
  const mode = classify(before);
  console.log(
    "[e2e] before=",
    JSON.stringify({ mode, ...before, re_register: mode === "empty" })
  );

  let productId = before.productId;
  let created = false;

  if (mode === "complete") {
    console.log("[e2e] action=verify_only");
  } else if (mode === "partial" && productId != null) {
    console.log("[e2e] action=repair_only");
    const actions = await repair(productId, before);
    console.log("[e2e] repair=", JSON.stringify(actions));
  } else {
    console.log("[e2e] action=create_once");
    productId = await createOnce();
    created = true;
  }

  if (productId == null) throw new Error("no product id");
  await verifyDupAndSummary(productId);

  const after = probeBySlug();
  console.log(
    "[e2e] after=",
    JSON.stringify({
      mode: classify(after),
      ...after,
      created_this_run: created,
      slug_count_ok: after.productCount === 1,
      media_count_ok: after.mediaCount === 1,
    })
  );
  console.log("[e2e] done");
}

main().catch((err) => {
  console.error("[e2e] failed", err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Staging-only: promote 5 official-INCI heroes into public `products`.
 * Batched SQL (few db query round-trips). Abort on Production.
 * No invented verified KR prices/stock.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const BATCH = [
  "banila-co-clean-it-zero-original",
  "anua-heartleaf-77-soothing-toner",
  "beauty-of-joseon-glow-serum-propolis-niacinamide",
  "round-lab-dokdo-toner",
  "isntree-hyaluronic-acid-watery-sun-gel",
];

function linkedRef() {
  return readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function sqlLiteral(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dbQuery(sql) {
  const tmp = path.join(tmpdir(), `kb-div2-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmp, sql.replace(/\s+/g, " ").trim(), "utf8");
  try {
    return execFileSync(
      npx,
      ["supabase", "db", "query", "--linked", "--file", tmp],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
    );
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function parseRows(out) {
  try {
    const json = JSON.parse(out);
    return Array.isArray(json.rows) ? json.rows : [];
  } catch {
    return [];
  }
}

function splitInci(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  const merged = [];
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    if (/^\d+$/.test(cur) && parts[i + 1] && /^\d-/.test(parts[i + 1])) {
      merged.push(`${cur},${parts[i + 1]}`);
      i++;
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function slugifyIngredient(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "ingredient"
  );
}

const ref = linkedRef();
if (ref !== STAGING || ref === PROD) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging" }));
  process.exit(2);
}

const sheet = JSON.parse(
  readFileSync(path.join(ROOT, "data/catalog/labels/official-inci-sheet.v1.json"), "utf8")
);
const byId = new Map(sheet.entries.map((e) => [e.externalProductId, e]));

const heroes = new Map(
  parseRows(
    dbQuery(`
      select external_product_id, brand_canonical, product_name_en, product_name_ko,
             category_canonical, official_product_url, evidence_concern_codes
      from catalog_staging_products
      where external_product_id in (${BATCH.map(sqlLiteral).join(",")});
    `)
  ).map((r) => [r.external_product_id, r])
);

const results = [];

for (const extId of BATCH) {
  const entry = byId.get(extId);
  const hero = heroes.get(extId);
  if (!entry?.applyReady || !entry.fullIngredientsRaw || !hero) {
    results.push({ externalProductId: extId, status: "skip" });
    continue;
  }

  const ingredients = splitInci(entry.fullIngredientsRaw);
  if (ingredients.length < 5) {
    results.push({ externalProductId: extId, status: "skip_inci", n: ingredients.length });
    continue;
  }

  const brand = hero.brand_canonical || entry.brandCanonical;
  const name = hero.product_name_en || entry.productNameEn || extId;
  const nameKo = hero.product_name_ko;
  const category = hero.category_canonical || "skincare";
  const concerns = Array.isArray(hero.evidence_concern_codes)
    ? hero.evidence_concern_codes.filter(Boolean)
    : [];
  const concernSql =
    concerns.length > 0
      ? `array[${concerns.map(sqlLiteral).join(",")}]::text[]`
      : `'{}'::text[]`;
  const fullSql = `array[${ingredients.map(sqlLiteral).join(",")}]::text[]`;
  const keySql = `array[${ingredients.slice(0, 5).map(sqlLiteral).join(",")}]::text[]`;

  // Insert or update by slug (no unique constraint / updated_at on Staging products)
  const existing = parseRows(
    dbQuery(`select id from products where slug = ${sqlLiteral(extId)} limit 1;`)
  );
  let productId = Number(existing[0]?.id || 0);

  if (productId) {
    dbQuery(`
      update products set
        brand = ${sqlLiteral(brand)},
        name = ${sqlLiteral(name)},
        name_ko = ${sqlLiteral(nameKo)},
        category = ${sqlLiteral(category)},
        skin_concern = ${concernSql},
        full_ingredients = ${fullSql},
        key_ingredients = ${keySql},
        active = true,
        verified_at = coalesce(verified_at, now()),
        data_confidence = 'official_inci_label_sheet'
      where id = ${productId};
    `);
  } else {
    const upsert = parseRows(
      dbQuery(`
        insert into products (
          brand, name, name_ko, category, slug, usage_area,
          skin_concern, full_ingredients, key_ingredients,
          recommendation_reason, recommendation_reason_ko,
          active, verified_at, data_confidence
        ) values (
          ${sqlLiteral(brand)},
          ${sqlLiteral(name)},
          ${sqlLiteral(nameKo)},
          ${sqlLiteral(category)},
          ${sqlLiteral(extId)},
          'face',
          ${concernSql},
          ${fullSql},
          ${keySql},
          ${sqlLiteral("Staging diversity batch — official INCI label sheet")},
          ${sqlLiteral("스테이징 다양성 배치 — 공식 전성분 라벨시트")},
          true,
          now(),
          'official_inci_label_sheet'
        )
        returning id;
      `)
    );
    productId = Number(upsert[0]?.id);
  }
  if (!productId) {
    results.push({ externalProductId: extId, status: "upsert_failed" });
    continue;
  }

  // Batch ingredients: VALUES list + join insert
  const ingValues = ingredients
    .map((token) => {
      const s = slugifyIngredient(token);
      return `(${sqlLiteral(s)}, ${sqlLiteral(token.slice(0, 120))}, ${sqlLiteral(
        "본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다."
      )}, '{}'::text[])`;
    })
    .join(",");

  dbQuery(`
    insert into ingredients (slug, name_en, caution, effects)
    values ${ingValues}
    on conflict (slug) do nothing;
  `);

  const linkValues = ingredients
    .map((token, i) => {
      const s = slugifyIngredient(token);
      return `(${productId}::bigint, (select id from ingredients where slug=${sqlLiteral(
        s
      )}), ${i + 1}, ${i < 5}, 'admin_entry', 'pending', true, 0.8)`;
    })
    .join(",");

  dbQuery(`
    insert into product_ingredients (
      product_id, ingredient_id, ingredient_order, is_key_ingredient,
      source_type, verification_status, source_verified, confidence
    )
    values ${linkValues}
    on conflict do nothing;
  `);

  dbQuery(`
    update catalog_staging_products
    set approved_product_id = ${productId}, updated_at = now()
    where external_product_id = ${sqlLiteral(extId)};
  `);

  const officialUrl = hero.official_product_url || entry.sourceUrl;
  if (officialUrl && /^https:\/\//i.test(officialUrl)) {
    const isKr = /\.co\.kr\//i.test(officialUrl);
    dbQuery(`
      insert into product_offers (
        product_id, retailer_name, retailer_country, ships_to_countries,
        purchase_url, price, currency, stock_status, verification_status,
        is_official, verified_at, active
      )
      select
        ${productId}::bigint,
        ${sqlLiteral(brand + " Official")},
        ${sqlLiteral(isKr ? "KR" : "US")},
        ${isKr ? `array['KR']::text[]` : `array['US']::text[]`},
        ${sqlLiteral(officialUrl)},
        null,
        ${sqlLiteral(isKr ? "KRW" : "USD")},
        'unknown',
        'unverified',
        true,
        null,
        true
      where not exists (
        select 1 from product_offers o
        where o.product_id = ${productId}::bigint
          and o.purchase_url = ${sqlLiteral(officialUrl)}
      );
    `);
  }

  const linkN = parseRows(
    dbQuery(
      `select count(*)::int as c from product_ingredients where product_id=${productId};`
    )
  )[0]?.c;

  results.push({
    externalProductId: extId,
    status: "ok",
    productId,
    brand,
    category,
    concerns,
    ingredientLinks: Number(linkN || 0),
  });
}

const summary = parseRows(
  dbQuery(`
    select
      (select count(*)::int from products where active and verified_at is not null) as public_products,
      (select count(distinct brand)::int from products where active and verified_at is not null) as public_brands,
      (select string_agg(distinct brand, ', ' order by brand) from products where active and verified_at is not null) as brands;
  `)
)[0];

console.log(
  JSON.stringify(
    {
      phase: "staging_diversity_batch",
      productionTouched: false,
      batch: results,
      public_products: summary?.public_products,
      public_brands: summary?.public_brands,
      brands: summary?.brands,
      note: "No fake verified KR offers — Top5 still COSRX until sale-checked KR offers exist.",
    },
    null,
    2
  )
);

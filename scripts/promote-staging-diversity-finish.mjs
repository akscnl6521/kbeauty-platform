#!/usr/bin/env node
/**
 * Staging-only finish: remaining diversity SKUs via service role (few round-trips).
 */
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const BATCH = [
  "beauty-of-joseon-glow-serum-propolis-niacinamide",
  "round-lab-dokdo-toner",
  "isntree-hyaluronic-acid-watery-sun-gel",
];

function linkedRef() {
  return readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function dbQuery(sql) {
  const tmp = path.join(tmpdir(), `kb-fin-${process.pid}-${Date.now()}.sql`);
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

function getServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const r = spawnSync(
    npx,
    ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "-o", "json"],
    { cwd: ROOT, encoding: "utf8", shell: true, env: { ...process.env, npm_config_loglevel: "silent" } }
  );
  const keys = JSON.parse((r.stdout || "").trim());
  for (const k of keys) {
    const val = k.api_key ?? k.key;
    if ((k.id === "service_role" || k.name === "service_role") && val) return String(val);
  }
  throw new Error("service_role missing");
}

function splitInci(raw) {
  const parts = String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [];
  for (let i = 0; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i]) && parts[i + 1] && /^\d-/.test(parts[i + 1])) {
      merged.push(`${parts[i]},${parts[i + 1]}`);
      i++;
    } else merged.push(parts[i]);
  }
  return merged;
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "ingredient"
  );
}

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging" }));
  process.exit(2);
}

const client = createClient(`https://${ref}.supabase.co`, getServiceRole(ref), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sheet = JSON.parse(
  readFileSync(path.join(ROOT, "data/catalog/labels/official-inci-sheet.v1.json"), "utf8")
);
const byId = new Map(sheet.entries.map((e) => [e.externalProductId, e]));

const HERO_FALLBACK = {
  "beauty-of-joseon-glow-serum-propolis-niacinamide": {
    brand_canonical: "Beauty of Joseon",
    product_name_en: "Glow Serum : Propolis + Niacinamide",
    product_name_ko: null,
    category_canonical: "serum",
    official_product_url:
      "https://beautyofjoseon.com/products/glow-serum-propolis-niacinamide",
    evidence_concern_codes: ["dryness", "pigmentation"],
  },
  "round-lab-dokdo-toner": {
    brand_canonical: "ROUND LAB",
    product_name_en: "ROUND LAB 1025 Dokdo Toner",
    product_name_ko: null,
    category_canonical: "toner",
    official_product_url: "https://roundlab.co.kr/products/dokdo-toner",
    evidence_concern_codes: ["dryness", "sensitivity"],
  },
  "isntree-hyaluronic-acid-watery-sun-gel": {
    brand_canonical: "Isntree",
    product_name_en: "Isntree Hyaluronic Acid Watery Sun Gel",
    product_name_ko: null,
    category_canonical: "sunscreen",
    official_product_url: "https://isntree.com/products/hyaluronic-acid-watery-sun-gel",
    evidence_concern_codes: ["uv", "dryness"],
  },
};

const heroMap = new Map(Object.entries(HERO_FALLBACK));
console.error(JSON.stringify({ heroesLoaded: heroMap.size, mode: "fallback_meta" }));
const out = [];

for (const extId of BATCH) {
  const entry = byId.get(extId);
  const hero = heroMap.get(extId);
  if (!entry?.fullIngredientsRaw || !hero) {
    out.push({ extId, status: "skip" });
    continue;
  }
  const ingredients = splitInci(entry.fullIngredientsRaw);
  const concerns = Array.isArray(hero.evidence_concern_codes)
    ? hero.evidence_concern_codes.filter(Boolean)
    : [];

  const { data: existing } = await client
    .from("products")
    .select("id")
    .eq("slug", extId)
    .maybeSingle();

  let productId = existing?.id ? Number(existing.id) : null;

  if (!productId) {
    const { data: inserted, error } = await client
      .from("products")
      .insert({
        brand: hero.brand_canonical,
        name: hero.product_name_en || entry.productNameEn,
        name_ko: hero.product_name_ko,
        category: hero.category_canonical || "skincare",
        slug: extId,
        usage_area: "face",
        skin_concern: concerns,
        full_ingredients: ingredients,
        key_ingredients: ingredients.slice(0, 5),
        recommendation_reason: "Staging diversity batch — official INCI label sheet",
        recommendation_reason_ko: "스테이징 다양성 배치 — 공식 전성분 라벨시트",
        active: true,
        verified_at: new Date().toISOString(),
        data_confidence: "official_inci_label_sheet",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      out.push({ extId, status: "insert_fail", message: error?.message });
      continue;
    }
    productId = Number(inserted.id);
  } else {
    await client
      .from("products")
      .update({
        full_ingredients: ingredients,
        key_ingredients: ingredients.slice(0, 5),
        skin_concern: concerns,
        active: true,
        data_confidence: "official_inci_label_sheet",
      })
      .eq("id", productId);
  }

  // ingredients upsert + links
  for (let i = 0; i < ingredients.length; i++) {
    const token = ingredients[i];
    const ingSlug = slugify(token);
    await client.from("ingredients").upsert(
      {
        slug: ingSlug,
        name_en: token.slice(0, 120),
        caution: "본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다.",
        effects: [],
      },
      { onConflict: "slug", ignoreDuplicates: true }
    );
    const { data: ing } = await client
      .from("ingredients")
      .select("id")
      .eq("slug", ingSlug)
      .single();
    if (!ing?.id) continue;
    await client.from("product_ingredients").upsert(
      {
        product_id: productId,
        ingredient_id: ing.id,
        ingredient_order: i + 1,
        is_key_ingredient: i < 5,
        source_type: "admin_entry",
        verification_status: "pending",
        source_verified: true,
        confidence: 0.8,
      },
      { onConflict: "product_id,ingredient_id", ignoreDuplicates: true }
    );
  }

  await client
    .from("catalog_staging_products")
    .update({ approved_product_id: productId })
    .eq("external_product_id", extId);

  const officialUrl = hero.official_product_url || entry.sourceUrl;
  if (officialUrl?.startsWith("https://")) {
    const isKr = /\.co\.kr\//i.test(officialUrl);
    const { data: offerExists } = await client
      .from("product_offers")
      .select("id")
      .eq("product_id", productId)
      .eq("purchase_url", officialUrl)
      .maybeSingle();
    if (!offerExists) {
      await client.from("product_offers").insert({
        product_id: productId,
        retailer_name: `${hero.brand_canonical} Official`,
        retailer_country: isKr ? "KR" : "US",
        ships_to_countries: isKr ? ["KR"] : ["US"],
        purchase_url: officialUrl,
        price: null,
        currency: isKr ? "KRW" : "USD",
        stock_status: "unknown",
        verification_status: "unverified",
        is_official: true,
        verified_at: null,
        active: true,
      });
    }
  }

  const { count } = await client
    .from("product_ingredients")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);

  out.push({
    extId,
    status: "ok",
    productId,
    brand: hero.brand_canonical,
    category: hero.category_canonical,
    concerns,
    links: count,
  });
}

const { data: pubs } = await client
  .from("products")
  .select("id, brand, slug")
  .eq("active", true)
  .not("verified_at", "is", null);

const brands = [...new Set((pubs || []).map((p) => p.brand))];

console.log(
  JSON.stringify(
    {
      phase: "staging_diversity_finish",
      productionTouched: false,
      batch: out,
      public_products: pubs?.length ?? 0,
      public_brands: brands.length,
      brands,
    },
    null,
    2
  )
);

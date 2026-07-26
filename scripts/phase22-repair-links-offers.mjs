/**
 * Phase 2.2 repair: link product_ingredients for ids 21-26,
 * insert out_of_stock offers with verification_status=unverified.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize.ts";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients.ts";

const ROOT = process.cwd();
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const ARTIFACT = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22/products.json"
);
const CASE_TAG = "[phase22-missing-slug-2026-07-22]";

function loadEnv(name) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function extractRef(url) {
  return (String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
}

function ingredientSlugFromName(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || `tok-${Date.now()}`
  );
}

async function ensureIngredient(client, token) {
  const slug = ingredientSlugFromName(token.normalizedName);
  const nameEn = token.token.slice(0, 120);
  const { data: existing } = await client
    .from("ingredients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id != null) return Number(existing.id);
  const { data: inserted, error } = await client
    .from("ingredients")
    .insert({
      slug,
      name_en: nameEn,
      caution: "본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다.",
      effects: [],
    })
    .select("id")
    .single();
  if (inserted?.id != null) return Number(inserted.id);
  const { data: again } = await client
    .from("ingredients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (again?.id != null) return Number(again.id);
  throw new Error(`ingredient:${slug}:${error?.message || "fail"}`);
}

const OOS_OFFERS = [
  {
    slug: "round-lab-dokdo-cream",
    retailer_name: "ROUND LAB 공식몰",
    purchase_url:
      "https://roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%81%AC%EB%A6%BC-80ml/24/",
    price: 25600,
    note: "공식몰 품절 확인",
  },
  {
    slug: "beauty-of-joseon-green-plum-refreshing-toner",
    retailer_name: "조선미녀 공식몰",
    purchase_url:
      "https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/",
    price: 18000,
    note: "공식몰 SOLD OUT 확인",
  },
];

const env = { ...loadEnv(".env.staging"), ...loadEnv(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const ref = extractRef(url);
if (ref === PROD_REF) throw new Error("PROD");
if (ref !== STAGING_REF) throw new Error("bad ref");
const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
const { data: products, error } = await client
  .from("products")
  .select("id,slug,key_ingredients,full_ingredients,active,verified_at")
  .in("slug", [
    "aestura-atobarrier365-cream",
    "round-lab-dokdo-cream",
    "torriden-dive-in-serum",
    "skin1004-madagascar-centella-ampoule",
    "beauty-of-joseon-green-plum-refreshing-toner",
    "haruharu-wonder-black-rice-hyaluronic-toner",
  ]);
if (error) throw error;

const report = { products: [], offers: [], errors: [] };

for (const p of products || []) {
  const art = artifact.products.find((x) => x.externalProductId === p.slug);
  const parsed = parseIngredientList(art?.ingredientsRaw || "");
  const keys = extractKeyIngredientsFromFullList(
    parsed.normalized.map((t) => ({
      token: t.token,
      normalizedName: t.normalizedName,
      order: t.order,
    }))
  );
  const keyOrder = new Set(keys.map((k) => k.orderInList));
  const { count: existingCount } = await client
    .from("product_ingredients")
    .select("id", { count: "exact", head: true })
    .eq("product_id", p.id);

  let linked = 0;
  let linkErrors = [];
  if ((existingCount || 0) === 0) {
    for (const token of parsed.normalized) {
      try {
        const ingredientId = await ensureIngredient(client, token);
        const { error: linkErr } = await client.from("product_ingredients").insert({
          product_id: p.id,
          ingredient_id: ingredientId,
          ingredient_order: token.order,
          is_key_ingredient: keyOrder.has(token.order),
          source_type: "admin_entry",
          source_url: art?.officialUrl || null,
          verification_status: "pending",
          source_verified: true,
          confidence: token.confidence ?? 0.9,
          verified_at: null,
        });
        if (linkErr) {
          linkErrors.push(`${token.token}:${linkErr.message}`);
          continue;
        }
        linked += 1;
      } catch (e) {
        linkErrors.push(String(e));
      }
    }
  }

  report.products.push({
    id: p.id,
    slug: p.slug,
    active: p.active,
    verified: Boolean(p.verified_at),
    keyCount: (p.key_ingredients || []).length,
    fullCount: (p.full_ingredients || []).length,
    existingIngredientLinks: existingCount || 0,
    newlyLinked: linked,
    linkErrorSample: linkErrors.slice(0, 3),
  });
}

const nowIso = new Date().toISOString();
for (const o of OOS_OFFERS) {
  const p = (products || []).find((x) => x.slug === o.slug);
  if (!p) continue;
  const { data: existing } = await client
    .from("product_offers")
    .select("id")
    .eq("product_id", p.id)
    .eq("purchase_url", o.purchase_url)
    .maybeSingle();
  if (existing) {
    report.offers.push({ slug: o.slug, status: "exists" });
    continue;
  }
  const { data, error: oErr } = await client
    .from("product_offers")
    .insert({
      product_id: p.id,
      retailer_name: o.retailer_name,
      retailer_country: "KR",
      ships_to_countries: ["KR"],
      purchase_url: o.purchase_url,
      price: o.price,
      currency: "KRW",
      stock_status: "out_of_stock",
      verification_status: "unverified",
      is_official: true,
      verified_at: null,
      last_checked_at: nowIso,
      active: true,
      source: `${CASE_TAG} ${o.note}`,
    })
    .select("id,stock_status,verification_status")
    .single();
  report.offers.push({
    slug: o.slug,
    status: oErr ? "failed" : "inserted",
    error: oErr?.message,
    row: data,
  });
}

console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(
    ROOT,
    "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase22-repair-result.json"
  ),
  JSON.stringify(report, null, 2)
);

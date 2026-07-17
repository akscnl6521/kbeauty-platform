#!/usr/bin/env node
/**
 * Staging-only: live catalog concern-compare prep —
 * count public products with/without KR verified offers (Top5 gate).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function linkedRef() {
  return readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function getServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const r = spawnSync(
    npx,
    ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "-o", "json"],
    {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  const keys = JSON.parse((r.stdout || "").trim());
  for (const k of keys) {
    const val = k.api_key ?? k.key;
    if ((k.id === "service_role" || k.name === "service_role") && val) return String(val);
  }
  throw new Error("service_role missing");
}

function isKrVerifiedOffer(o) {
  if (o.active === false) return false;
  if (o.verification_status !== "verified") return false;
  if (!o.verified_at) return false;
  if (o.retailer_country !== "KR") return false;
  if (o.currency !== "KRW") return false;
  if (o.price == null || !(Number(o.price) > 0)) return false;
  if (o.stock_status !== "in_stock") return false;
  if (!String(o.purchase_url || "").startsWith("https://")) return false;
  const ships = o.ships_to_countries || [];
  return ships.includes("KR");
}

/** Preview official_global mode: official verified in_stock shipping to KR */
function isPreviewOfficialOffer(o) {
  if (o.active === false) return false;
  if (o.verification_status !== "verified") return false;
  if (!o.verified_at) return false;
  if (o.is_official !== true) return false;
  if (o.price == null || !(Number(o.price) > 0)) return false;
  if (o.stock_status !== "in_stock") return false;
  if (!String(o.purchase_url || "").startsWith("https://")) return false;
  const ships = o.ships_to_countries || [];
  return ships.includes("KR");
}

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging" }));
  process.exit(2);
}

const client = createClient(`https://${ref}.supabase.co`, getServiceRole(ref), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: products, error } = await client
  .from("products")
  .select("id, slug, brand, name, category, skin_concern")
  .eq("active", true)
  .not("verified_at", "is", null);

if (error) {
  console.log(JSON.stringify({ phase: "abort", reason: error.message }));
  process.exit(1);
}

const ids = (products || []).map((p) => p.id);
const { data: offers } = await client
  .from("product_offers")
  .select(
    "product_id, retailer_country, currency, price, stock_status, verification_status, verified_at, purchase_url, ships_to_countries, active, is_official"
  )
  .in("product_id", ids);

const byPid = new Map();
for (const o of offers || []) {
  const list = byPid.get(o.product_id) || [];
  list.push(o);
  byPid.set(o.product_id, list);
}

const withOffer = [];
const withoutOffer = [];
const withPreviewOfficial = [];
for (const p of products || []) {
  const olist = byPid.get(p.id) || [];
  const ok = olist.some(isKrVerifiedOffer);
  const previewOk = olist.some(isPreviewOfficialOffer);
  const row = {
    id: p.id,
    brand: p.brand,
    slug: p.slug,
    category: p.category,
    concerns: p.skin_concern || [],
  };
  (ok ? withOffer : withoutOffer).push(row);
  if (previewOk) withPreviewOfficial.push(row);
}

// Concern coverage among Top5-eligible pool only
const concernHits = {};
for (const p of withOffer) {
  for (const c of p.concerns || []) {
    concernHits[c] = (concernHits[c] || 0) + 1;
  }
}

console.log(
  JSON.stringify(
    {
      phase: "staging_concern_offer_compare",
      productionTouched: false,
      public_products: products.length,
      top5_eligible_kr_offer: withOffer.length,
      top5_ineligible_no_kr_offer: withoutOffer.length,
      preview_official_global_eligible: withPreviewOfficial.length,
      eligible_brands: [...new Set(withOffer.map((p) => p.brand))],
      preview_eligible_brands: [
        ...new Set(withPreviewOfficial.map((p) => p.brand)),
      ],
      ineligible_brands: [...new Set(withoutOffer.map((p) => p.brand))],
      eligible_slugs: withOffer.map((p) => p.slug),
      preview_eligible_slugs: withPreviewOfficial.map((p) => p.slug),
      ineligible_slugs: withoutOffer.map((p) => p.slug),
      concern_tag_counts_on_eligible: concernHits,
      interpretation:
        "Strict KR Top5 still COSRX-only until KRW Olive Young (etc.) sale-checked. Preview uses official_global mode so USD official verified offers that ship to KR can enter Top5.",
    },
    null,
    2
  )
);

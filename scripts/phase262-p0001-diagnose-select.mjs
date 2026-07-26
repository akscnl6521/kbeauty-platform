/**
 * SELECT-only diagnosis for BOJ verify P0001 (0-row UPDATE).
 * No writes. Staging only.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const SLUG = "beauty-of-joseon-green-plum-refreshing-toner";
const EXPECTED_OFFER_ID = "13fe02a6-5519-41b7-afba-8505cad70c01";
const ROUND_LAB_ID = "2fcb8bde-d3f6-482f-8eca-f0908378bff3";

function load(n) {
  const p = path.join(ROOT, n);
  if (!fs.existsSync(p)) return {};
  const o = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    o[m[1]] = v;
  }
  return o;
}
function refOf(url) {
  return (String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
}

const env = {
  ...load(".env.staging"),
  ...load(".env.preview.staging"),
  ...load(".env.local"),
};
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const key =
  env.SUPABASE_SERVICE_ROLE_KEY || env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
const ref = refOf(url);
if (ref === PROD) throw new Error("ABORT Production");
if (ref !== STAGING) throw new Error("ABORT unexpected ref");

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: products, error: pErr } = await admin
  .from("products")
  .select("id, slug, name, name_ko, brand")
  .eq("slug", SLUG);
if (pErr) throw pErr;

const product = (products || [])[0] || null;
const productId = product?.id ?? null;

const { data: offers, error: oErr } = productId
  ? await admin
      .from("product_offers")
      .select(
        "id, product_id, retailer_name, retailer_country, purchase_url, price, currency, stock_status, verification_status, is_official, active, verified_at, last_checked_at"
      )
      .eq("product_id", productId)
  : { data: [], error: null };
if (oErr) throw oErr;

const allOffers = offers || [];

// Also fetch by expected ID in case product_id mismatch
const { data: byExpectedId, error: eErr } = await admin
  .from("product_offers")
  .select(
    "id, product_id, retailer_name, retailer_country, purchase_url, price, currency, stock_status, verification_status, is_official, active, verified_at, last_checked_at"
  )
  .eq("id", EXPECTED_OFFER_ID);
if (eErr) throw eErr;

const { data: roundLab, error: rErr } = await admin
  .from("product_offers")
  .select(
    "id, product_id, retailer_name, verification_status, stock_status, price, is_official, active"
  )
  .eq("id", ROUND_LAB_ID);
if (rErr) throw rErr;

const expectedWhere = {
  id: EXPECTED_OFFER_ID,
  product_id: 25,
  verification_status: "unverified",
  stock_status: "out_of_stock",
  is_official: true,
  retailer_country: "KR",
  price: 18000,
  currency: "KRW",
  active: true,
  purchase_url_like_host: "https://beautyofjoseon.co.kr/",
  purchase_url_like_31: "/31",
};

function diagnoseOffer(o) {
  if (!o) {
    return { exists: false, failing: ["offer_row_missing"] };
  }
  const failing = [];
  const checks = {
    id_match: o.id === expectedWhere.id,
    product_id_match: Number(o.product_id) === expectedWhere.product_id,
    verification_status_unverified: o.verification_status === "unverified",
    stock_status_oos: o.stock_status === "out_of_stock",
    is_official_true: o.is_official === true,
    retailer_country_kr: o.retailer_country === "KR",
    price_18000:
      Number(o.price) === 18000 || o.price === 18000 || o.price === "18000",
    price_raw: o.price,
    price_type: typeof o.price,
    currency_krw: o.currency === "KRW",
    active_true: o.active === true,
    url_host: String(o.purchase_url || "").startsWith(
      expectedWhere.purchase_url_like_host
    ),
    url_has_31: String(o.purchase_url || "").includes(
      expectedWhere.purchase_url_like_31
    ),
  };
  for (const [k, v] of Object.entries(checks)) {
    if (k.startsWith("price_raw") || k === "price_type") continue;
    if (v !== true) failing.push(k);
  }
  return { exists: true, checks, failing };
}

const targetFromProduct = allOffers.find((o) => o.id === EXPECTED_OFFER_ID) || null;
const targetById = (byExpectedId || [])[0] || null;
const primary = targetFromProduct || targetById || allOffers[0] || null;

const diagPrimary = diagnoseOffer(primary);
const diagExpectedId = diagnoseOffer(targetById);

// Simulate each WHERE clause filter count on all offers for product
function countMatching(predicate) {
  return allOffers.filter(predicate).length;
}

const filterSteps = [
  {
    step: "product_id = actual product id",
    count: allOffers.length,
  },
  {
    step: `id = ${EXPECTED_OFFER_ID}`,
    count: countMatching((o) => o.id === EXPECTED_OFFER_ID),
  },
  {
    step: "verification_status = unverified",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID && o.verification_status === "unverified"
    ),
  },
  {
    step: "stock_status = out_of_stock",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID &&
        o.verification_status === "unverified" &&
        o.stock_status === "out_of_stock"
    ),
  },
  {
    step: "is_official = true",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID &&
        o.verification_status === "unverified" &&
        o.stock_status === "out_of_stock" &&
        o.is_official === true
    ),
  },
  {
    step: "retailer_country = KR",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID &&
        o.verification_status === "unverified" &&
        o.stock_status === "out_of_stock" &&
        o.is_official === true &&
        o.retailer_country === "KR"
    ),
  },
  {
    step: "price = 18000 (Number strict)",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID &&
        o.verification_status === "unverified" &&
        o.stock_status === "out_of_stock" &&
        o.is_official === true &&
        o.retailer_country === "KR" &&
        Number(o.price) === 18000
    ),
  },
  {
    step: "currency = KRW",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID &&
        o.verification_status === "unverified" &&
        o.stock_status === "out_of_stock" &&
        o.is_official === true &&
        o.retailer_country === "KR" &&
        Number(o.price) === 18000 &&
        o.currency === "KRW"
    ),
  },
  {
    step: "active = true",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID &&
        o.verification_status === "unverified" &&
        o.stock_status === "out_of_stock" &&
        o.is_official === true &&
        o.retailer_country === "KR" &&
        Number(o.price) === 18000 &&
        o.currency === "KRW" &&
        o.active === true
    ),
  },
  {
    step: "purchase_url LIKE beautyofjoseon + /31",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID &&
        o.verification_status === "unverified" &&
        o.stock_status === "out_of_stock" &&
        o.is_official === true &&
        o.retailer_country === "KR" &&
        Number(o.price) === 18000 &&
        o.currency === "KRW" &&
        o.active === true &&
        String(o.purchase_url || "").startsWith("https://beautyofjoseon.co.kr/") &&
        String(o.purchase_url || "").includes("/31")
    ),
  },
  {
    step: "product_id = 25 (hardcoded in failed SQL)",
    count: countMatching(
      (o) =>
        o.id === EXPECTED_OFFER_ID && Number(o.product_id) === 25
    ),
  },
];

const out = {
  ok: true,
  phase: "p0001_select_only_diagnosis",
  projectRef: "jfnj***gfd",
  write: 0,
  expected_offer_id: EXPECTED_OFFER_ID,
  expected_product_id_hardcoded: 25,
  product,
  actual_product_id: productId,
  product_id_matches_hardcoded_25: Number(productId) === 25,
  offers_for_product: allOffers,
  offer_by_expected_id: byExpectedId || [],
  round_lab: roundLab || [],
  diagnosis_primary: diagPrimary,
  diagnosis_expected_id_row: diagExpectedId,
  filter_steps: filterSteps,
  first_failing_step:
    filterSteps.find((s) => s.count === 0)?.step ||
    (allOffers.length === 0 ? "no offers for product" : null),
  notes: {
    rls_policy_check:
      "RLS ALTER is not readable via PostgREST; if P0001 rolled back whole BEGIN, policy should be unchanged. Confirm with Dashboard SELECT on pg_policies if needed.",
    checked_at_column: "table has last_checked_at (no checked_at column)",
  },
};

const outPath = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase262-p0001-diagnosis.json"
);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

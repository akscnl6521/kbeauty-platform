/**
 * Phase 2.6.1 — SELECT-only exposure estimate for DRAFT OOS RLS.
 * No writes. Aborts on Production ref.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";

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

function extractRef(url) {
  return (String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
}

const env = {
  ...load(".env.staging"),
  ...load(".env.preview.staging"),
  ...load(".env.local"),
};
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY || env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.STAGING_SUPABASE_ANON_KEY || "";
const ref = extractRef(url);
if (ref === PROD) throw new Error("ABORT Production");
if (ref !== STAGING) throw new Error("ABORT unexpected ref");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cols =
  "id,product_id,retailer_name,retailer_country,stock_status,verification_status,is_official,price,currency,purchase_url,active,source,rating,review_count";

const { data: allRows, error: allErr } = await admin
  .from("product_offers")
  .select(cols);
if (allErr) throw allErr;
const all = allRows || [];

const { data: anonRows, error: anonErr } = await anon
  .from("product_offers")
  .select("id");
if (anonErr) throw anonErr;

function httpsOk(u) {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

function matchCurrent(r) {
  return (
    r.active === true &&
    r.verification_status === "verified" &&
    r.stock_status === "in_stock"
  );
}

function matchDraftAsWritten(r) {
  if (r.active !== true) return false;
  if (
    r.verification_status === "verified" &&
    r.stock_status === "in_stock"
  )
    return true;
  return (
    r.is_official === true &&
    ["out_of_stock", "unknown"].includes(r.stock_status) &&
    ["verified", "unverified"].includes(r.verification_status) &&
    ["KR", "US", "JP"].includes(r.retailer_country) &&
    r.price != null &&
    Number(r.price) > 0 &&
    r.currency != null &&
    httpsOk(r.purchase_url)
  );
}

/** Acceptance criteria: verified + official + KR only + OOS/unknown */
function matchAcceptance(r) {
  if (r.active !== true) return false;
  if (
    r.verification_status === "verified" &&
    r.stock_status === "in_stock"
  )
    return true;
  return (
    r.is_official === true &&
    r.verification_status === "verified" &&
    r.retailer_country === "KR" &&
    ["out_of_stock", "unknown"].includes(r.stock_status) &&
    r.price != null &&
    Number(r.price) > 0 &&
    r.currency === "KRW" &&
    httpsOk(r.purchase_url)
  );
}

/** Hybrid that would fix BOJ but fails verified-only: official KR OOS unverified */
function matchOfficialKrOosIncludingUnverified(r) {
  if (r.active !== true) return false;
  if (
    r.verification_status === "verified" &&
    r.stock_status === "in_stock"
  )
    return true;
  return (
    r.is_official === true &&
    r.retailer_country === "KR" &&
    ["out_of_stock", "unknown"].includes(r.stock_status) &&
    ["verified", "unverified"].includes(r.verification_status) &&
    !["invalid", "unavailable"].includes(r.verification_status) &&
    r.price != null &&
    Number(r.price) > 0 &&
    r.currency === "KRW" &&
    httpsOk(r.purchase_url)
  );
}

function summarize(label, pred) {
  const rows = all.filter(pred);
  const added = rows.filter((r) => !matchCurrent(r));
  return {
    label,
    visible_total: rows.length,
    added_beyond_current: added.length,
    added_rows: added.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      retailer_name: r.retailer_name,
      retailer_country: r.retailer_country,
      stock_status: r.stock_status,
      verification_status: r.verification_status,
      is_official: r.is_official,
      price: r.price,
      currency: r.currency,
    })),
  };
}

const out = {
  ok: true,
  phase: "2.6.1_rls_review_select_only",
  projectRef: "jfnj***gfd",
  write: 0,
  table_total_rows_service_role: all.length,
  anon_visible_now: (anonRows || []).length,
  current_policy_estimate: summarize("current", matchCurrent),
  draft_as_written: summarize("draft_as_written", matchDraftAsWritten),
  acceptance_verified_official_kr: summarize(
    "acceptance_verified_official_kr",
    matchAcceptance
  ),
  hybrid_official_kr_allow_unverified_oos: summarize(
    "hybrid_official_kr_allow_unverified_oos",
    matchOfficialKrOosIncludingUnverified
  ),
  column_inventory: [
    "id",
    "product_id",
    "retailer_name",
    "retailer_country",
    "ships_to_countries",
    "purchase_url",
    "price",
    "currency",
    "stock_status",
    "verification_status",
    "is_official",
    "verified_at",
    "last_checked_at",
    "active",
    "rating",
    "review_count",
    "source",
    "last_review_sync_at",
    "created_at",
    "updated_at",
  ],
  sensitive_columns_present: {
    internal_memo: false,
    cost_or_cogs: false,
    admin_notes: false,
    source_field_exists: true,
    rating_review_fields_exist: true,
  },
};

fs.writeFileSync(
  path.join(
    ROOT,
    "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase261-rls-exposure-select.json"
  ),
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out, null, 2));

/**
 * Post-Dashboard apply verification (SELECT-only).
 * Run after user applies STAGING_ONLY_APPLY_20260722_boj_verify_and_rls_a.sql
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fetchCandidateProductsBySlugs } from "../src/lib/recommend/fetchCandidateProducts.ts";
import { deriveCommerceAvailability } from "../src/lib/recommend/commerceStatus.ts";
import {
  isOfferEligibleForCoreRecommendation,
  resolveProductOffers,
} from "../src/lib/recommend/productOffer.ts";
import { buildScenarioPilotPreviewSamples } from "../src/lib/recommend/scenarios/pilotPhase2/previewDebug.ts";
import { runScenarioPilotPhase2 } from "../src/lib/recommend/scenarios/pilotPhase2/runScenarioPilotPhase2.ts";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const BOJ_OFFER_ID = "13fe02a6-5519-41b7-afba-8505cad70c01";
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
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] == null) process.env[k] = v;
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
  "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.STAGING_SUPABASE_ANON_KEY ||
  "";
const ref = refOf(url);
if (ref === PROD) throw new Error("ABORT Production");
if (ref !== STAGING) throw new Error("ABORT unexpected ref");

process.env.RECOMMEND_COMMERCE_SEPARATION =
  process.env.RECOMMEND_COMMERCE_SEPARATION || "1";
process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 =
  process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 || "true";

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: bojAdmin } = await admin
  .from("product_offers")
  .select(
    "id,verification_status,stock_status,price,active,is_official,retailer_country,retailer_name,purchase_url"
  )
  .eq("id", BOJ_OFFER_ID)
  .maybeSingle();

const { data: anonRows, error: anonErr } = await anon
  .from("product_offers")
  .select(
    "id,product_id,stock_status,verification_status,is_official,retailer_country,price"
  );
if (anonErr) throw anonErr;
const rows = anonRows || [];
const added = rows.filter(
  (r) =>
    !(r.verification_status === "verified" && r.stock_status === "in_stock")
);

const sampleC = buildScenarioPilotPreviewSamples().find((s) => s.id === "C");
const result = await runScenarioPilotPhase2({
  recommendation: sampleC.recommendation,
  fetchCandidatesBySlugs: (slugs) =>
    fetchCandidateProductsBySlugs(slugs, { includeOffers: true }),
  shippingCountry: "KR",
});

const ranked = result.ranked.map((r, i) => {
  const offers = resolveProductOffers(r.product);
  const commerce = deriveCommerceAvailability({
    offers,
    shippingCountry: "KR",
  });
  return {
    rank: i + 1,
    slug: r.product.slug,
    commerce_status: commerce.commerce_status,
    cta_active: offers.some((o) =>
      isOfferEligibleForCoreRecommendation(o, "KR")
    ),
    offer_count: offers.length,
  };
});

const report = {
  ok: true,
  phase: "post_apply_verify",
  projectRef: "jfnj***gfd",
  production_write: 0,
  boj_admin: bojAdmin,
  anon_visible: rows.length,
  expect_anon: 21,
  added_beyond_in_stock: added,
  boj_anon_visible: rows.some((r) => r.id === BOJ_OFFER_ID),
  round_lab_anon_visible: rows.some((r) => r.id === ROUND_LAB_ID),
  scenario_c: {
    status: result.status,
    ranked,
  },
  assertions: {
    boj_verified_oos:
      bojAdmin?.verification_status === "verified" &&
      bojAdmin?.stock_status === "out_of_stock" &&
      bojAdmin?.price === 18000,
    anon_21: rows.length === 21,
    added_only_boj:
      added.length === 1 && added[0]?.id === BOJ_OFFER_ID,
    boj_in_top_oos_cta_off: ranked.some(
      (r) =>
        r.slug === "beauty-of-joseon-green-plum-refreshing-toner" &&
        r.commerce_status === "out_of_stock" &&
        r.cta_active === false
    ),
    haruharu_unknown: ranked.some(
      (r) =>
        r.slug === "haruharu-wonder-black-rice-hyaluronic-toner" &&
        r.commerce_status === "availability_unknown" &&
        r.cta_active === false
    ),
  },
};

fs.writeFileSync(
  path.join(
    ROOT,
    "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase262-post-apply-verify.json"
  ),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));
const a = report.assertions;
if (
  !a.boj_verified_oos ||
  !a.anon_21 ||
  !a.added_only_boj ||
  !a.boj_in_top_oos_cta_off
) {
  process.exit(2);
}

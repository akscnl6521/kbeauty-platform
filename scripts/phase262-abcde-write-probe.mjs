/**
 * Quick anon privilege check + A/B/D/E snapshot (SELECT-only / local ranking).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fetchCandidateProductsBySlugs } from "../src/lib/recommend/fetchCandidateProducts.ts";
import { buildScenarioPilotPreviewSamples } from "../src/lib/recommend/scenarios/pilotPhase2/previewDebug.ts";
import { runScenarioPilotPhase2 } from "../src/lib/recommend/scenarios/pilotPhase2/runScenarioPilotPhase2.ts";

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
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.STAGING_SUPABASE_ANON_KEY ||
  "";
const ref = refOf(url);
if (ref === PROD) throw new Error("ABORT Production");
if (ref !== STAGING) throw new Error("ABORT unexpected ref");

process.env.RECOMMEND_COMMERCE_SEPARATION = "1";
process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 = "true";

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// write probe (must fail)
const probeId = "13fe02a6-5519-41b7-afba-8505cad70c01";
const { error: updErr } = await anon
  .from("product_offers")
  .update({ price: 18000 })
  .eq("id", probeId);
const { error: insErr } = await anon.from("product_offers").insert({
  product_id: 25,
  retailer_name: "probe-should-fail",
  retailer_country: "KR",
  ships_to_countries: ["KR"],
  purchase_url: "https://example.com/x",
  price: 1,
  currency: "KRW",
  stock_status: "in_stock",
  verification_status: "unverified",
});
const { error: delErr } = await anon
  .from("product_offers")
  .delete()
  .eq("id", probeId);

const samples = buildScenarioPilotPreviewSamples();
const out = [];
for (const s of samples) {
  const result = await runScenarioPilotPhase2({
    recommendation: s.recommendation,
    fetchCandidatesBySlugs: (slugs) =>
      fetchCandidateProductsBySlugs(slugs, { includeOffers: true }),
    shippingCountry: "KR",
  });
  out.push({
    id: s.id,
    status: result.status,
    rankedCount: result.ranked.length,
    top: result.ranked.slice(0, 3).map((r) => r.product.slug),
  });
}

const report = {
  ok: true,
  projectRef: "jfnj***gfd",
  write: 0,
  anon_write_blocked: {
    update_error: updErr?.message || updErr?.code || null,
    insert_error: insErr?.message || insErr?.code || null,
    delete_error: delErr?.message || delErr?.code || null,
    update_blocked: Boolean(updErr),
    insert_blocked: Boolean(insErr),
    delete_blocked: Boolean(delErr),
  },
  scenarios: out,
};
fs.writeFileSync(
  path.join(
    ROOT,
    "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase262-abcde-and-write-probe.json"
  ),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));

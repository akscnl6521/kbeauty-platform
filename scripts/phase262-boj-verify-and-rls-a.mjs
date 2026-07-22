/**
 * Staging-only: dry-run BOJ official KR OOS offer → verify status only → apply A RLS.
 * B exception NEVER applied. Production abort. ROUND LAB untouched.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const STAGING = "jfnjufmldiqlgvgyugfd";
const BOJ_OFFER_ID = "13fe02a6-5519-41b7-afba-8505cad70c01";
const BOJ_PRODUCT_ID = 25;
const BOJ_URL =
  "https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/";
const MODE = (process.env.PHASE262_MODE || "dry-run").toLowerCase(); // dry-run | apply-verify | apply-rls | verify-anon

function mask(ref) {
  return !ref || ref.length < 7 ? "***" : `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}
function fail(msg) {
  console.error(JSON.stringify({ ok: false, error: msg }, null, 2));
  process.exit(1);
}
function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
function load(name) {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
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
function linkedRef() {
  const refFile = path.join(root, "supabase", ".temp", "project-ref");
  if (existsSync(refFile)) return readFileSync(refFile, "utf8").trim();
  return "";
}
function dbQuery(sqlText) {
  const f = path.join(tmpdir(), `kb-a-${process.pid}-${Date.now()}.sql`);
  writeFileSync(f, sqlText, "utf8");
  const r = spawnSync(npx(), ["supabase", "db", "query", "--linked", "--file", f], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, npm_config_loglevel: "silent" },
  });
  try {
    unlinkSync(f);
  } catch {
    /* ignore */
  }
  if (r.status !== 0) {
    console.error((r.stdout || "").slice(0, 2500));
    console.error((r.stderr || "").slice(0, 2500));
    fail(`db query failed status=${r.status}`);
  }
  return (r.stdout || "").trim();
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
if (ref === PROD) fail("ABORT Production");
if (ref !== STAGING) fail(`ABORT unexpected ref ${mask(ref)}`);
const link = linkedRef();
if (link && link !== STAGING) fail(`ABORT linked ref ${mask(link)}`);

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchPdp() {
  const r = await fetch(BOJ_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });
  const html = await r.text();
  const title = (html.match(/<title>([^<]+)/) || [])[1] || "";
  const sold = /SOLD OUT|품절/i.test(html);
  const price18000 =
    /18,?000\s*원/.test(html) || /판매가[\s\S]{0,40}18,?000/.test(html);
  const nameOk = /청매실\s*AHA\s*BHA\s*토너/i.test(html);
  const vol150 = /150\s*ml/i.test(html);
  return {
    status: r.status,
    title: title.slice(0, 120),
    sold,
    price18000,
    nameOk,
    vol150,
    url: BOJ_URL,
  };
}

async function selectBojOffers() {
  const { data, error } = await admin
    .from("product_offers")
    .select(
      "id,product_id,retailer_name,retailer_country,stock_status,verification_status,is_official,price,currency,purchase_url,active,verified_at,last_checked_at"
    )
    .eq("product_id", BOJ_PRODUCT_ID);
  if (error) throw error;
  return data || [];
}

async function selectRoundLabOffers() {
  const { data, error } = await admin
    .from("product_offers")
    .select("id,product_id,verification_status,stock_status,retailer_name")
    .eq("id", "2fcb8bde-d3f6-482f-8eca-f0908378bff3");
  if (error) throw error;
  return data || [];
}

async function anonCountAndIds() {
  const { data, error } = await anon
    .from("product_offers")
    .select("id,product_id,stock_status,verification_status,is_official,retailer_country,retailer_name,price");
  if (error) throw error;
  return data || [];
}

const pdp = await fetchPdp();
const offers = await selectBojOffers();
const target = offers.filter(
  (o) =>
    o.id === BOJ_OFFER_ID &&
    o.product_id === BOJ_PRODUCT_ID &&
    o.is_official === true &&
    o.retailer_country === "KR" &&
    o.stock_status === "out_of_stock" &&
    o.price === 18000 &&
    o.currency === "KRW" &&
    o.active === true &&
    String(o.purchase_url || "").includes("beautyofjoseon.co.kr") &&
    String(o.purchase_url || "").includes("/31")
);

const dry = {
  ok: true,
  mode: MODE,
  projectRef: mask(STAGING),
  linkedRef: link ? mask(link) : null,
  production_write: 0,
  pdp,
  staging_offers_for_product_25: offers.length,
  matching_target_count: target.length,
  target: target[0] || null,
  pdp_match:
    pdp.status === 200 &&
    pdp.sold === true &&
    pdp.price18000 === true &&
    pdp.nameOk === true,
  // 150ml: historical PDP evidence; live HTML may omit ml in above-fold — soft check
  volume_note: pdp.vol150
    ? "150ml present on PDP"
    : "150ml not in fetched HTML snippet; keep existing SKU identity (Phase 2.3 confirmed 150ml)",
  proceed_gate:
    target.length === 1 &&
    pdp.status === 200 &&
    pdp.sold === true &&
    pdp.price18000 === true &&
    pdp.nameOk === true &&
    target[0].verification_status === "unverified",
};

const outDir = path.join(
  root,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22"
);
mkdirSync(outDir, { recursive: true });

if (MODE === "dry-run") {
  writeFileSync(
    path.join(outDir, "phase262-boj-verify-dry-run.json"),
    JSON.stringify(dry, null, 2)
  );
  console.log(JSON.stringify(dry, null, 2));
  process.exit(dry.proceed_gate ? 0 : 2);
}

if (!dry.proceed_gate && MODE === "apply-verify") {
  // allow re-run if already verified
  const already =
    target.length === 1 && target[0].verification_status === "verified";
  if (!already) {
    writeFileSync(
      path.join(outDir, "phase262-boj-verify-dry-run.json"),
      JSON.stringify(dry, null, 2)
    );
    fail("dry-run gate failed; refuse write");
  }
}

if (MODE === "apply-verify") {
  // Only verification_status (+ verified_at required for truthful "verified" semantics without flipping stock)
  // User asked verification_status ONLY. Do not touch stock/price/url/seller/active.
  // Setting verified_at is required for app verified-branch; if strictly forbidden, leave null —
  // A RLS does not need verified_at. User: "verification_status만" → update that single column.
  const before = { ...target[0] };
  const { data: updated, error: upErr } = await admin
    .from("product_offers")
    .update({ verification_status: "verified" })
    .eq("id", BOJ_OFFER_ID)
    .eq("product_id", BOJ_PRODUCT_ID)
    .eq("verification_status", "unverified")
    .eq("stock_status", "out_of_stock")
    .eq("price", 18000)
    .eq("is_official", true)
    .eq("retailer_country", "KR")
    .eq("active", true)
    .select(
      "id,product_id,verification_status,stock_status,price,currency,purchase_url,retailer_name,active,is_official,verified_at"
    );
  if (upErr) fail(upErr.message);
  if (!updated || updated.length !== 1) {
    fail(`expected exactly 1 updated row, got ${updated?.length ?? 0}`);
  }
  const roundLab = await selectRoundLabOffers();
  const report = {
    ok: true,
    phase: "apply-verify",
    projectRef: mask(STAGING),
    updated_count: updated.length,
    before: {
      id: before.id,
      verification_status: before.verification_status,
      stock_status: before.stock_status,
      price: before.price,
      purchase_url: before.purchase_url,
      retailer_name: before.retailer_name,
      active: before.active,
    },
    after: updated[0],
    unchanged_fields: {
      stock_status: updated[0].stock_status === "out_of_stock",
      price: updated[0].price === 18000,
      active: updated[0].active === true,
      retailer_name: updated[0].retailer_name === before.retailer_name,
      purchase_url: updated[0].purchase_url === before.purchase_url,
    },
    round_lab_untouched:
      roundLab[0]?.verification_status === "unverified" &&
      roundLab[0]?.stock_status === "out_of_stock",
    production_write: 0,
  };
  writeFileSync(
    path.join(outDir, "phase262-boj-verify-apply.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (MODE === "apply-rls") {
  // Confirm BOJ is verified first
  const { data: boj, error: bojErr } = await admin
    .from("product_offers")
    .select("id,verification_status,stock_status,is_official,retailer_country")
    .eq("id", BOJ_OFFER_ID)
    .maybeSingle();
  if (bojErr) fail(bojErr.message);
  if (
    !boj ||
    boj.verification_status !== "verified" ||
    boj.stock_status !== "out_of_stock" ||
    boj.is_official !== true ||
    boj.retailer_country !== "KR"
  ) {
    fail("BOJ offer not in required verified+OOS+official+KR state");
  }

  if (!link) fail("supabase not linked; refuse ALTER POLICY without linked Staging");

  const sql = `
BEGIN;

ALTER POLICY "Allow anon read all product_offers"
  ON public.product_offers
  TO anon, authenticated
  USING (
    active = true
    AND (
      (
        verification_status = 'verified'
        AND stock_status = 'in_stock'
      )
      OR (
        is_official = true
        AND verification_status = 'verified'
        AND retailer_country = 'KR'
        AND stock_status IN ('out_of_stock', 'unknown')
        AND price IS NOT NULL
        AND price > 0
        AND currency = 'KRW'
        AND purchase_url LIKE 'https://%'
      )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.product_offers FROM anon, authenticated;
GRANT SELECT ON public.product_offers TO anon, authenticated;

COMMIT;
`;
  const out = dbQuery(sql);
  const anonRows = await anonCountAndIds();
  const added = anonRows.filter(
    (r) =>
      !(r.verification_status === "verified" && r.stock_status === "in_stock")
  );
  const report = {
    ok: true,
    phase: "apply-rls-A-strict",
    projectRef: mask(STAGING),
    db_query_tail: String(out).slice(-500),
    anon_visible: anonRows.length,
    expect_anon_visible: 21,
    added_beyond_in_stock: added,
    boj_visible: anonRows.some((r) => r.id === BOJ_OFFER_ID),
    round_lab_not_visible: !anonRows.some(
      (r) => r.id === "2fcb8bde-d3f6-482f-8eca-f0908378bff3"
    ),
    production_write: 0,
    b_exception_applied: false,
  };
  writeFileSync(
    path.join(outDir, "phase262-rls-a-apply.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  if (anonRows.length !== 21 || added.length !== 1 || !report.boj_visible) {
    fail("anon visibility assertion failed");
  }
  process.exit(0);
}

if (MODE === "verify-anon") {
  const anonRows = await anonCountAndIds();
  const privileges = dbQuery(`
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='product_offers'
  AND grantee IN ('anon','authenticated')
ORDER BY grantee, privilege_type;
`);
  const report = {
    ok: true,
    phase: "verify-anon",
    projectRef: mask(STAGING),
    anon_visible: anonRows.length,
    boj: anonRows.find((r) => r.id === BOJ_OFFER_ID) || null,
    round_lab_visible: anonRows.some(
      (r) => r.id === "2fcb8bde-d3f6-482f-8eca-f0908378bff3"
    ),
    grants_raw_tail: String(privileges).slice(0, 1500),
  };
  writeFileSync(
    path.join(outDir, "phase262-anon-verify.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

fail(`unknown MODE=${MODE}`);

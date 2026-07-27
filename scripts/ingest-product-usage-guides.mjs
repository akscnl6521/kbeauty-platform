#!/usr/bin/env node
/**
 * Load collected §36.5 usage guidance into Staging.
 *
 * Always writes verification_status='needs_review'. It never writes 'approved' —
 * the schema would refuse it without a verified_at anyway, and approval is a
 * human decision in /admin/usage-guides.
 *
 * Idempotent: (product_id, variant_id, locale, source_url) is unique, so a
 * re-run updates the extracted fields of an existing row rather than duplicating
 * it, and resets it to needs_review when the source page changed.
 *
 *   node scripts/ingest-product-usage-guides.mjs            # dry run
 *   node scripts/ingest-product-usage-guides.mjs --write    # write to Staging
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";
const WRITE = process.argv.includes("--write");
const RECHECK_DAYS = 30;

function fail(msg) {
  console.error(`[ingest:usage-guides] FAIL: ${msg}`);
  process.exit(1);
}

function loadEnvFile(name) {
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
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const registryRoot = path.join(root, "data", "usage-guides");
if (!existsSync(registryRoot)) {
  fail("no collected candidates — run npm run usage:collect-guides first");
}
const days = readdirSync(registryRoot)
  .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
  .sort();
if (days.length === 0) fail("no dated candidate snapshot found");
const day = days[days.length - 1];
const snapshot = path.join(registryRoot, day, "candidates.json");
if (!existsSync(snapshot)) fail(`candidates.json missing in ${day}`);

const parsed = JSON.parse(readFileSync(snapshot, "utf8"));
const eligible = (parsed.candidates ?? []).filter((c) => c.usable);

console.log(`[ingest:usage-guides] snapshot ${day}`);
console.log(
  `[ingest:usage-guides] ${parsed.candidates?.length ?? 0} collected · ${eligible.length} with usable guidance`
);

if (eligible.length === 0) {
  console.log("[ingest:usage-guides] nothing to ingest");
  process.exit(0);
}

if (!WRITE) {
  for (const c of eligible.slice(0, 40)) {
    const bits = [
      c.amountLabel ? `양:${c.amountLabel}` : null,
      c.applicationArea?.length ? `부위:${c.applicationArea.join("/")}` : null,
      c.frequency ? `시점:${c.frequency}` : null,
      `단계:${c.methodSteps.length}`,
    ]
      .filter(Boolean)
      .join(" · ");
    console.log(`  would upsert [${c.locale}] ${String(c.brand ?? "").slice(0, 12).padEnd(12)} ${bits}`);
  }
  if (eligible.length > 40) console.log(`  … and ${eligible.length - 40} more`);
  console.log("");
  console.log("[ingest:usage-guides] dry run — pass --write to apply to Staging");
  process.exit(0);
}

const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) fail("Staging URL / service role key missing");
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
if (ref === PROD_REF) fail("refusing to write to Production");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { error: probeError } = await admin
  .from("product_usage_guides")
  .select("id")
  .limit(1);
if (probeError) {
  fail(
    `product_usage_guides not reachable (${probeError.message.slice(0, 60)}) — apply supabase/migrations/20260727150000_create_product_usage_guides.sql first`
  );
}

const now = new Date();
const nextCheck = new Date(now.getTime() + RECHECK_DAYS * 24 * 60 * 60 * 1000);

let inserted = 0;
let updated = 0;
let unchanged = 0;
let failed = 0;

for (const c of eligible) {
  const row = {
    product_id: c.productId,
    variant_id: null,
    locale: c.locale ?? "ko",
    amount_label: c.amountLabel,
    order_index: 1,
    order_hints: c.orderHints ?? [],
    frequency: c.frequency,
    time_of_day: null,
    application_area: c.applicationArea ?? [],
    method_steps: c.methodSteps ?? [],
    caution_text: c.cautionText ?? [],
    statutory_notices: c.statutoryNotices ?? [],
    combination_cautions: [],
    source_type: c.sourceType ?? "official_brand",
    source_url: c.sourceUrl,
    source_domain: c.sourceDomain,
    source_excerpt: c.sourceExcerpt,
    extraction_method: "automated_extraction",
    content_hash: c.contentHash,
    missing_fields: c.missingFields ?? [],
    verification_status: "needs_review",
    last_checked_at: now.toISOString(),
    next_check_due_at: nextCheck.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data: existing, error: lookupError } = await admin
    .from("product_usage_guides")
    .select("id, content_hash, verification_status")
    .eq("product_id", c.productId)
    .eq("locale", row.locale)
    .eq("source_url", c.sourceUrl)
    .is("variant_id", null)
    .maybeSingle();

  if (lookupError) {
    failed += 1;
    console.error(`  ! lookup ${c.productId}: ${lookupError.message.slice(0, 70)}`);
    continue;
  }

  if (!existing) {
    const { error } = await admin.from("product_usage_guides").insert(row);
    if (error) {
      failed += 1;
      console.error(`  ! insert ${c.productId}: ${error.message.slice(0, 70)}`);
      continue;
    }
    inserted += 1;
    console.log(`  + [${row.locale}] ${String(c.brand ?? "").slice(0, 14)} ${String(c.productName ?? "").slice(0, 34)}`);
    continue;
  }

  if (existing.content_hash === c.contentHash) {
    unchanged += 1;
    continue;
  }

  // Source page changed — re-open the review rather than silently keeping an
  // approval that was made against different text.
  const { error } = await admin
    .from("product_usage_guides")
    .update({ ...row, verified_at: null, verified_by: null })
    .eq("id", existing.id);
  if (error) {
    failed += 1;
    console.error(`  ! update ${c.productId}: ${error.message.slice(0, 70)}`);
    continue;
  }
  updated += 1;
  console.log(`  ~ [${row.locale}] source changed → back to needs_review (${c.productId})`);
}

console.log("");
console.log(
  `[ingest:usage-guides] inserted ${inserted} · updated ${updated} · unchanged ${unchanged} · failed ${failed}`
);
console.log("[ingest:usage-guides] every row is needs_review — approve in /admin/usage-guides");

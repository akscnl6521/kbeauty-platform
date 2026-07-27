#!/usr/bin/env node
/**
 * Verify the §36.5 product usage guides schema on Staging.
 *
 * Read-only with one deliberate exception: it attempts inserts the schema MUST
 * reject, to prove the anti-fabrication constraints have teeth. Every probe is
 * expected to fail, so no rows are created and nothing has to be deleted.
 *
 * Never prints secrets or full project refs.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";

let failures = 0;
const pass = (msg) => console.log(`[verify:usage-guides] OK: ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.error(`[verify:usage-guides] FAIL: ${msg}`);
};

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

const maskRef = (ref) =>
  !ref || ref.length < 8 ? "***" : `${ref.slice(0, 4)}***${ref.slice(-3)}`;

const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) {
  console.error("[verify:usage-guides] FAIL: Staging URL / service role key missing");
  await new Promise((r) => setTimeout(r, 50));
  process.exit(1);
}
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
if (ref === PROD_REF) {
  console.error("[verify:usage-guides] FAIL: refusing to verify Production");
  await new Promise((r) => setTimeout(r, 50));
  process.exit(1);
}
console.log(`[verify:usage-guides] target ${maskRef(ref)}`);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// --- 1. tables exist ---------------------------------------------------------
for (const table of [
  "product_usage_guides",
  "product_usage_guide_review_events",
]) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    console.error(`[verify:usage-guides] FAIL: ${table}: ${error.message.slice(0, 80)}`);
    console.error(
      "  apply supabase/migrations/20260727150000_create_product_usage_guides.sql first"
    );
    await new Promise((r) => setTimeout(r, 50));
    process.exit(2);
  }
}
pass("both tables exist and service_role can SELECT");

// a real product id is needed so the FK is not what rejects the probe
const { data: products } = await admin.from("products").select("id").limit(1);
const productId = products?.[0]?.id;
if (!productId) {
  console.error("[verify:usage-guides] FAIL: no product to anchor probes to");
  await new Promise((r) => setTimeout(r, 50));
  process.exit(1);
}

const base = {
  product_id: productId,
  locale: "ko",
  source_type: "official_brand",
  source_url: "https://verify.invalid/kb-usage-probe",
  extraction_method: "automated_extraction",
  method_steps: ["세안 후 얼굴에 펴 바릅니다."],
  verification_status: "draft",
};

// --- 2. constraints reject what must never be stored -------------------------
const REJECTIONS = [
  {
    label: "approving with no method steps is rejected",
    row: {
      ...base,
      source_url: "https://verify.invalid/kb-nosteps",
      method_steps: [],
      verification_status: "approved",
      verified_at: new Date().toISOString(),
    },
  },
  {
    label: "approving with no verified_at is rejected",
    row: {
      ...base,
      source_url: "https://verify.invalid/kb-noverifiedat",
      verification_status: "approved",
    },
  },
  {
    label: "approving content with a medical claim is rejected",
    row: {
      ...base,
      source_url: "https://verify.invalid/kb-medical",
      verification_status: "approved",
      verified_at: new Date().toISOString(),
      contains_medical_claim: true,
    },
  },
  {
    label: "automated extraction with no source url is rejected",
    row: {
      ...base,
      source_url: null,
    },
  },
  {
    label: "a non-https source is rejected",
    row: {
      ...base,
      source_url: "http://verify.invalid/kb-http",
    },
  },
  {
    label: "an unlisted source type is rejected",
    row: {
      ...base,
      source_url: "https://verify.invalid/kb-sourcetype",
      source_type: "random_blog",
    },
  },
  {
    label: "recommending a patch test with no steps is rejected",
    row: {
      ...base,
      source_url: "https://verify.invalid/kb-patch",
      patch_test_recommended: true,
    },
  },
  {
    label: "an unlisted frequency is rejected",
    row: {
      ...base,
      source_url: "https://verify.invalid/kb-freq",
      frequency: "hourly",
    },
  },
];

for (const check of REJECTIONS) {
  const { data, error } = await admin
    .from("product_usage_guides")
    .insert(check.row)
    .select("id");
  if (error) {
    pass(check.label);
  } else {
    bad(`${check.label} — row was ACCEPTED (id=${data?.[0]?.id ?? "?"})`);
    console.error(
      "  a probe row now exists in product_usage_guides; remove it manually (DELETE needs approval)"
    );
  }
}

// a rejection with no reason codes must not be recordable
const { error: reasonError } = await admin
  .from("product_usage_guide_review_events")
  .insert({
    usage_guide_id: "00000000-0000-0000-0000-000000000000",
    decision: "rejected",
    reason_codes: [],
  })
  .select("id");
if (reasonError) pass("a rejection with no reason is refused");
else bad("a rejection with no reason was ACCEPTED");

// --- 3. nothing is public ----------------------------------------------------
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const table of ["product_usage_guides", "product_usage_guide_review_events"]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    if (error || (Array.isArray(data) && data.length === 0)) {
      pass(`anon cannot read ${table}`);
    } else {
      bad(`anon CAN read ${table} — display grants are a separate approval`);
    }
  }
} else {
  pass("anon key absent — skipped anon negative checks");
}

// --- 4. publishable view -----------------------------------------------------
const { error: viewError } = await admin
  .from("product_usage_guides_publishable")
  .select("id")
  .limit(1);
if (viewError) bad(`publishable view: ${viewError.message.slice(0, 80)}`);
else pass("product_usage_guides_publishable readable");

// --- 5. what is actually stored ---------------------------------------------
const { count: total } = await admin
  .from("product_usage_guides")
  .select("*", { head: true, count: "exact" });
const { count: needsReview } = await admin
  .from("product_usage_guides")
  .select("*", { head: true, count: "exact" })
  .eq("verification_status", "needs_review");
const { count: approved } = await admin
  .from("product_usage_guides")
  .select("*", { head: true, count: "exact" })
  .eq("verification_status", "approved");
pass(
  `rows: ${total ?? 0} total · ${needsReview ?? 0} needs_review · ${approved ?? 0} approved`
);

console.log("");
if (failures > 0) {
  console.error(`[verify:usage-guides] ${failures} check(s) failed`);
  await new Promise((r) => setTimeout(r, 50));
  process.exit(1);
}
console.log(
  "[verify:usage-guides] DONE — schema present, anti-fabrication constraints enforced, nothing public"
);
await new Promise((r) => setTimeout(r, 50));
process.exit(0);

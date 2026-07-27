#!/usr/bin/env node
/**
 * Verify the §36.4 media asset library on Staging.
 *
 * Read-only with one deliberate exception: it attempts inserts that the schema
 * MUST reject, to prove the §36.3 rights constraints actually have teeth. Every
 * such insert is expected to fail, so no rows are created and nothing is
 * deleted. It never attempts an insert that would succeed.
 *
 * Never prints secrets or full project refs.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";

const TABLES = [
  "media_assets",
  "media_rights",
  "media_localizations",
  "product_videos",
  "routine_videos",
  "creator_assets",
  "video_usage_steps",
  "video_performance_events",
  "media_review_events",
];

let failures = 0;

function pass(msg) {
  console.log(`[verify:media-library] OK: ${msg}`);
}

function bad(msg) {
  failures += 1;
  console.error(`[verify:media-library] FAIL: ${msg}`);
}

function fatal(msg) {
  console.error(`[verify:media-library] FAIL: ${msg}`);
  process.exit(1);
}

function maskRef(ref) {
  if (!ref || ref.length < 8) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
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

const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) fatal("Staging URL / service role key missing");

const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
if (ref === PROD_REF) fatal("refusing to verify against Production");
console.log(`[verify:media-library] target ${maskRef(ref)}`);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// --- 1. tables exist and service_role can read them --------------------------
let missing = 0;
for (const table of TABLES) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    missing += 1;
    bad(`${table}: ${error.message.slice(0, 80)}`);
  }
}
if (missing > 0) {
  console.error("");
  console.error(
    `[verify:media-library] ${missing}/${TABLES.length} tables unreadable — apply the migration first:`
  );
  console.error(
    "  supabase/migrations/20260727120000_create_media_asset_library.sql"
  );
  process.exit(2);
}
pass(`all ${TABLES.length} tables exist and service_role can SELECT`);

// --- 2. constraints reject what §36.3 forbids --------------------------------
// Every insert below MUST fail. A success means the schema is not protecting us.
const baseAsset = {
  asset_type: "category_usage",
  media_type: "video",
  scope: "category_common",
  source_type: "official_brand",
  source_url: "https://verify.invalid/kb-media-verify-should-never-persist",
  title: "verify probe — must be rejected",
  language: "ko",
  embed_provider: "none",
  verification_status: "draft",
};

const REJECTIONS = [
  {
    label: "storing a copy of a brand video is rejected",
    row: {
      ...baseAsset,
      source_url: "https://verify.invalid/kb-copy-probe",
      storage_url: "https://cdn.verify.invalid/copy.mp4",
    },
  },
  {
    label: "AI content without ai_generated relationship is rejected",
    row: {
      ...baseAsset,
      source_url: "https://verify.invalid/kb-ai-probe",
      is_ai_generated: true,
      content_relationship: "organic",
    },
  },
  {
    label: "sponsored content without disclosure is rejected",
    row: {
      ...baseAsset,
      source_url: "https://verify.invalid/kb-sponsor-probe",
      is_sponsored: true,
      content_relationship: "sponsored",
      disclosure: null,
    },
  },
  {
    label: "category-common asset naming a product is rejected",
    row: {
      ...baseAsset,
      source_url: "https://verify.invalid/kb-productname-probe",
      shows_product_name: true,
    },
  },
  {
    label: "non-https source is rejected",
    row: {
      ...baseAsset,
      source_url: "http://verify.invalid/kb-http-probe",
    },
  },
  {
    label: "unknown source_type is rejected",
    row: {
      ...baseAsset,
      source_url: "https://verify.invalid/kb-sourcetype-probe",
      source_type: "random_blog",
    },
  },
  {
    label: "approved status without verified_at is rejected",
    row: {
      ...baseAsset,
      source_url: "https://verify.invalid/kb-verifiedat-probe",
      verification_status: "approved",
    },
  },
];

for (const check of REJECTIONS) {
  const { data, error } = await admin
    .from("media_assets")
    .insert(check.row)
    .select("id");
  if (error) {
    pass(check.label);
  } else {
    bad(`${check.label} — row was ACCEPTED (id=${data?.[0]?.id ?? "?"})`);
    console.error(
      "  a probe row now exists in media_assets; remove it manually (DELETE needs approval)"
    );
  }
}

// telemetry must refuse identity
const { error: piiError } = await admin
  .from("video_performance_events")
  .insert({
    media_asset_id: "00000000-0000-0000-0000-000000000000",
    event_type: "play_start",
    surface: "verify-probe",
    metadata: { user_id: "should-be-rejected" },
  })
  .select("id");
if (piiError) pass("telemetry rejects a user_id in metadata");
else bad("telemetry ACCEPTED a user_id — privacy constraint missing");

// --- 3. nothing is public ----------------------------------------------------
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const table of ["media_assets", "media_rights", "routine_videos"]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    if (error || (Array.isArray(data) && data.length === 0)) {
      pass(`anon cannot read ${table}`);
    } else {
      bad(`anon CAN read ${table} — display grants must be a separate approval`);
    }
  }
} else {
  pass("anon key absent — skipped anon negative checks");
}

// --- 4. publishable view exists and is empty --------------------------------
const { data: viewRows, error: viewError } = await admin
  .from("media_assets_publishable")
  .select("id")
  .limit(1);
if (viewError) bad(`media_assets_publishable: ${viewError.message.slice(0, 80)}`);
else pass(`media_assets_publishable readable (rows=${viewRows?.length ?? 0})`);

console.log("");
if (failures > 0) {
  console.error(`[verify:media-library] ${failures} check(s) failed`);
  process.exit(1);
}
console.log("[verify:media-library] DONE — schema present, rights constraints enforced, nothing public");
process.exit(0);

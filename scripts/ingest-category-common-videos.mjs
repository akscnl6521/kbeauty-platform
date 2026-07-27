#!/usr/bin/env node
/**
 * Load collected category-common candidates into the Staging media library.
 *
 * Writes media_assets + media_rights + routine_videos, always at
 * verification_status='needs_review'. It never writes 'approved' — a human does
 * that in /admin/media-review. It never stores a copy of anyone's video: only the
 * source URL and the embed id.
 *
 * Idempotent: media_assets.source_url is unique, so a re-run skips what exists.
 *
 *   node scripts/ingest-category-common-videos.mjs            # dry run
 *   node scripts/ingest-category-common-videos.mjs --write    # write to Staging
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";
const WRITE = process.argv.includes("--write");

function fail(msg) {
  console.error(`[ingest:category-videos] FAIL: ${msg}`);
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

// --- newest collected snapshot ----------------------------------------------
const registryRoot = path.join(root, "data", "media", "category-common");
if (!existsSync(registryRoot)) {
  fail("no collected candidates — run scripts/collect-category-common-videos.ts first");
}
const days = readdirSync(registryRoot)
  .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
  .sort();
if (days.length === 0) fail("no dated candidate snapshot found");
const snapshot = path.join(registryRoot, days[days.length - 1], "candidates.json");
if (!existsSync(snapshot)) fail(`candidates.json missing in ${days[days.length - 1]}`);

const parsed = JSON.parse(readFileSync(snapshot, "utf8"));
const eligible = (parsed.candidates ?? []).filter(
  (c) => c.ingestible && c.classification?.scope === "category_common"
);

console.log(`[ingest:category-videos] snapshot ${days[days.length - 1]}`);
console.log(
  `[ingest:category-videos] ${parsed.candidates?.length ?? 0} collected · ${eligible.length} category-common and ingestible`
);

if (eligible.length === 0) {
  console.log("");
  console.log(
    "[ingest:category-videos] nothing to ingest — no category-common asset cleared the §36.3 gate."
  );
  console.log(
    "  Official brand channels publish product marketing; product-specific assets are a later track."
  );
  process.exit(0);
}

if (!WRITE) {
  for (const c of eligible) {
    console.log(`  would insert: ${c.brand} | ${c.title.slice(0, 60)}`);
  }
  console.log("");
  console.log("[ingest:category-videos] dry run — pass --write to apply to Staging");
  process.exit(0);
}

// --- write -------------------------------------------------------------------
const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) fail("Staging URL / service role key missing");
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
if (ref === PROD_REF) fail("refusing to write to Production");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { error: probeError } = await admin.from("media_assets").select("id").limit(1);
if (probeError) {
  fail(
    `media_assets not reachable (${probeError.message.slice(0, 60)}) — apply the migration first`
  );
}

let inserted = 0;
let skipped = 0;

for (const c of eligible) {
  const { data: existing } = await admin
    .from("media_assets")
    .select("id")
    .eq("source_url", c.sourceUrl)
    .limit(1);
  if (existing && existing.length > 0) {
    skipped += 1;
    continue;
  }

  const { data: asset, error: assetError } = await admin
    .from("media_assets")
    .insert({
      asset_type:
        c.classification.routineContext === "am_routine"
          ? "routine_morning"
          : c.classification.routineContext === "pm_routine"
            ? "routine_evening"
            : "category_usage",
      media_type: "video",
      scope: "category_common",
      source_type: c.sourceType,
      source_url: c.sourceUrl,
      source_domain: "youtube.com",
      source_page_url: c.channelEvidenceUrl,
      storage_url: null,
      embed_provider: c.embedProvider,
      embed_id: c.embedId,
      channel_name: c.channelName,
      channel_url: `https://www.youtube.com/channel/${c.channelId}`,
      title: c.title,
      language: c.language,
      country: "KR",
      category_slug: c.classification.categorySlug,
      concern_tags: [],
      body_area_tags: [],
      content_relationship: "organic",
      shows_product_name: false,
      verification_status: "needs_review",
      is_accessible: true,
      last_checked_at: new Date().toISOString(),
      next_check_due_at: c.rights.reviewDueAt,
    })
    .select("id")
    .single();

  if (assetError) {
    console.error(`  ! ${c.title.slice(0, 40)}: ${assetError.message.slice(0, 80)}`);
    continue;
  }

  const { error: rightsError } = await admin.from("media_rights").insert({
    media_asset_id: asset.id,
    rights_status: c.rights.rightsStatus,
    rights_basis: c.rights.rightsBasis,
    rights_holder: c.rights.rightsHolder,
    allows_embed: c.rights.allowsEmbed,
    allows_copy: false,
    allows_download: false,
    allows_modification: false,
    rights_start_at: c.rights.rightsStartAt,
    rights_end_at: c.rights.rightsEndAt,
    is_worldwide: c.rights.isWorldwide,
    territory_codes: c.rights.territoryCodes,
    evidence_url: c.rights.evidenceUrl,
    evidence_note: c.rights.rightsEndAtNote,
    review_due_at: c.rights.reviewDueAt,
  });
  if (rightsError) {
    console.error(`  ! rights for ${asset.id}: ${rightsError.message.slice(0, 80)}`);
    continue;
  }

  const { error: linkError } = await admin.from("routine_videos").insert({
    media_asset_id: asset.id,
    routine_context: c.classification.routineContext ?? "category_common",
    category_slug: c.classification.categorySlug,
    is_active: false,
  });
  if (linkError) {
    console.error(`  ! link for ${asset.id}: ${linkError.message.slice(0, 80)}`);
    continue;
  }

  inserted += 1;
  console.log(`  + ${c.brand} | ${c.title.slice(0, 55)}`);
}

console.log("");
console.log(
  `[ingest:category-videos] inserted ${inserted}, skipped ${skipped} (already present)`
);
console.log("[ingest:category-videos] all rows are needs_review — approve in /admin/media-review");

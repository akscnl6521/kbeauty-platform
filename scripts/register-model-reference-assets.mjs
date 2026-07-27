#!/usr/bin/env node
/**
 * Register the brand model reference images in the §36.4 media library.
 *
 * These are AI-generated stills of the platform's own representative model,
 * used as the face-identity reference for every future demonstration video. They
 * are our own output, so source_type is platform_original — the only category
 * the schema lets hold a stored copy.
 *
 * Idempotent: re-running skips images already registered (matched on storage_url).
 * Never approves — rows land at needs_review like everything else.
 *
 *   node scripts/register-model-reference-assets.mjs           # dry run
 *   node scripts/register-model-reference-assets.mjs --write    # upload + register
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";
const WRITE = process.argv.includes("--write");
const BUCKET = "model-assets";
const MODEL_DIR = path.join(root, "data", "model-assets", "kbm-main-model");

function fail(msg) {
  console.error(`[model-assets] FAIL: ${msg}`);
  process.exitCode = 1;
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
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !serviceKey) {
  fail("Staging URL / service role key missing");
  process.exit(1);
}
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) ?? [])[1] ?? "";
if (ref === PROD_REF) {
  fail("refusing to write to Production");
  process.exit(1);
}

const manifestPath = path.join(MODEL_DIR, "manifest.json");
if (!existsSync(manifestPath)) {
  fail("manifest.json missing — write it before registering");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

console.log(
  `[model-assets] target ${ref.slice(0, 4)}***${ref.slice(-3)} · mode ${WRITE ? "WRITE" : "dry run"}`
);
console.log(
  `[model-assets] model ${manifest.modelId} · ${manifest.images.length} reference images`
);

const objectUrl = (objectPath) =>
  `${url.replace(/\/+$/, "")}/storage/v1/object/${BUCKET}/${objectPath}`;

const planned = manifest.images.map((image) => {
  const objectPath = `${manifest.modelId}/${image.file}`;
  return {
    file: image.file,
    localPath: path.join(MODEL_DIR, image.file),
    objectPath,
    storageUrl: objectUrl(objectPath),
    title: `${manifest.displayName} 레퍼런스 ${String(image.index).padStart(2, "0")} — ${image.angle}`,
    angle: image.angle,
    sha256: image.sha256,
  };
});

for (const item of planned) {
  if (!existsSync(item.localPath)) {
    fail(`missing file ${item.file}`);
    process.exit(1);
  }
  console.log(`  ${item.file.padEnd(42)} ${item.angle}`);
}

if (!WRITE) {
  console.log("");
  console.log("[model-assets] dry run — pass --write to upload and register");
  process.exit(0);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// --- bucket ------------------------------------------------------------------
const { data: buckets } = await admin.storage.listBuckets();
if (!(buckets ?? []).some((b) => b.name === BUCKET)) {
  const { error } = await admin.storage.createBucket(BUCKET, { public: false });
  if (error) {
    fail(`could not create bucket: ${error.message}`);
    process.exit(1);
  }
  console.log(`[model-assets] created private bucket "${BUCKET}"`);
} else {
  console.log(`[model-assets] bucket "${BUCKET}" already present`);
}

// --- upload + register -------------------------------------------------------
let uploaded = 0;
let registered = 0;
let skipped = 0;
let failed = 0;

for (const item of planned) {
  const bytes = readFileSync(item.localPath);
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(item.objectPath, bytes, {
      contentType: "image/png",
      upsert: true,
    });
  if (uploadError) {
    failed += 1;
    console.error(`  ! upload ${item.file}: ${uploadError.message.slice(0, 70)}`);
    continue;
  }
  uploaded += 1;

  const { data: existing } = await admin
    .from("media_assets")
    .select("id")
    .eq("storage_url", item.storageUrl)
    .limit(1);
  if (existing && existing.length > 0) {
    skipped += 1;
    continue;
  }

  const { data: asset, error: assetError } = await admin
    .from("media_assets")
    .insert({
      asset_type: "other",
      media_type: "image",
      scope: "brand_general",
      source_type: "platform_original",
      source_url: null,
      storage_url: item.storageUrl,
      embed_provider: "none",
      title: item.title,
      summary: `${manifest.purpose} (${item.angle})`,
      language: "ko",
      country: "KR",
      concern_tags: [],
      body_area_tags: ["face"],
      content_relationship: "ai_generated",
      disclosure: manifest.disclosure.text,
      is_ai_generated: true,
      shows_product_name: false,
      verification_status: "needs_review",
      is_accessible: true,
      last_checked_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (assetError) {
    failed += 1;
    console.error(`  ! register ${item.file}: ${assetError.message.slice(0, 90)}`);
    continue;
  }

  const { error: rightsError } = await admin.from("media_rights").insert({
    media_asset_id: asset.id,
    rights_status: "owned",
    rights_basis: `자체 AI 생성 (${manifest.generator.tool}, ${manifest.generator.generatedAt}). 고정 프롬프트는 data/model-assets/${manifest.modelId}/manifest.json 참조`,
    rights_holder: "K-Beauty Match",
    allows_embed: true,
    allows_copy: true,
    allows_download: true,
    allows_modification: true,
    rights_start_at: new Date().toISOString(),
    rights_end_at: null,
    is_worldwide: true,
    territory_codes: [],
    evidence_note: `sha256 ${item.sha256.slice(0, 16)}…`,
  });
  if (rightsError) {
    failed += 1;
    console.error(`  ! rights ${item.file}: ${rightsError.message.slice(0, 70)}`);
    continue;
  }

  // audit: the asset entered the review queue and why
  await admin.from("media_review_events").insert({
    media_asset_id: asset.id,
    reviewer_id: null,
    decision: "needs_review",
    previous_status: null,
    reason_codes: ["initial_registration", "ai_generated_reference"],
    note: `브랜드 대표 모델 레퍼런스 등록 (${manifest.modelId} / ${item.file})`,
  });

  registered += 1;
  console.log(`  + ${item.file}`);
}

console.log("");
console.log(
  `[model-assets] uploaded ${uploaded} · registered ${registered} · already present ${skipped} · failed ${failed}`
);
console.log("[model-assets] all rows are needs_review — nothing is published");
if (failed > 0) process.exitCode = 1;

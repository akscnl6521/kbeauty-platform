/**
 * Validate verified-kbeauty-batch import bundle rules.
 * npx --yes tsx scripts/verified-kbeauty-batch-selftest.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "imports", "verified-kbeauty-batch");
const PROD = "rhfrmvkjsummaylpzmns";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let checks = 0;

for (const f of [
  "products.csv",
  "offers.csv",
  "media.csv",
  "ingredients.json",
  "sources.json",
  "manifest.json",
]) {
  assert(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  checks += 1;
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(dir, "manifest.json"), "utf8")
);
assert(manifest.auto_verified === false, "auto_verified forbidden");
assert(manifest.production_write === false, "production_write false");
assert(
  [
    "SKIPPED",
    "ALLOWED_BUT_NOT_EXECUTED_IN_BUILD",
    "APPLIED_PARTIAL",
    "APPLIED",
  ].includes(String(manifest.staging?.write_status || "")),
  "staging write status recognized"
);
assert(manifest.counts.READY_FOR_REVIEW >= 5, "at least 5 READY_FOR_REVIEW");
assert(manifest.counts.official_images >= 5, "at least 5 official images");
assert(manifest.counts.kr_offers >= 5, "at least 5 KR offers");
checks += 1;

const products = fs.readFileSync(path.join(dir, "products.csv"), "utf8");
assert(products.includes("review_status"), "review_status column");
assert(products.includes("needs_review"), "needs_review values");
assert(!/,"true",\s*"true"\s*$/m.test(products.split("\n")[1] ?? ""), "sanity");
for (const line of products.split("\n").slice(1)) {
  if (!line.trim()) continue;
  assert(line.includes("needs_review"), "row needs_review");
  assert(line.includes(",false,false,"), "verified/active false");
}
checks += 1;

const offers = fs.readFileSync(path.join(dir, "offers.csv"), "utf8");
assert(offers.includes("verification_status"), "offer verification column");
assert(offers.includes("unverified"), "offers start unverified");
assert(offers.includes("KRW"), "KRW required");
assert(offers.includes("in_stock"), "in_stock offers present");
assert(!offers.includes(",verified,"), "no auto offer verified");
checks += 1;

const ingredients = JSON.parse(
  fs.readFileSync(path.join(dir, "ingredients.json"), "utf8")
);
for (const [slug, row] of Object.entries(ingredients) as [string, any][]) {
  assert(row.invented === false, `${slug} not invented`);
  assert(
    String(row.full_ingredients_verbatim_ko || "").length > 20,
    `${slug} has INCI`
  );
  assert(Array.isArray(row.normalized_list) && row.normalized_list.length > 3);
}
checks += 1;

const media = fs.readFileSync(path.join(dir, "media.csv"), "utf8");
assert(media.includes("is_official_source"), "official media");
const imagesDir = path.join(dir, "images");
assert(fs.existsSync(imagesDir), "images dir");
const imgs = fs.readdirSync(imagesDir).filter((f) => !f.startsWith("."));
assert(imgs.length >= 5, "downloaded images >= 5");
for (const img of imgs) {
  const st = fs.statSync(path.join(imagesDir, img));
  assert(st.size >= 1000, `${img} not tiny placeholder`);
}
checks += 1;

const sources = JSON.parse(
  fs.readFileSync(path.join(dir, "sources.json"), "utf8")
);
assert(sources.policy.auto_verified === false, "policy no auto verified");
assert(
  sources.policy.forbid.includes("ai_generated_inci"),
  "forbid ai inci"
);
const blocked = sources.products.filter((p: any) => p.status === "BLOCKED");
assert(blocked.length >= 1, "blocked products recorded honestly");
for (const p of blocked) {
  if (p.stock_status === "out_of_stock") {
    assert(
      String(p.stock_evidence || "").length > 0,
      "blocked stock evidence"
    );
  }
}
checks += 1;

// Production write block helper (read-only gate file)
const buildScript = fs.readFileSync(
  path.join(root, "scripts/build-verified-kbeauty-batch.mjs"),
  "utf8"
);
assert(buildScript.includes(PROD), "knows production ref");
assert(buildScript.includes("No DB writes"), "no db writes documented");
checks += 1;

console.log(
  JSON.stringify({
    ok: true,
    checks,
    ready: manifest.counts.READY_FOR_REVIEW,
    blocked: manifest.counts.BLOCKED,
    stagingWrite: manifest.staging.write_status,
    autoVerified: false,
    inventedData: false,
  })
);

#!/usr/bin/env node
/**
 * Read-only scan: which catalog product names failed to decode?
 *
 * Korean brand storefronts serve EUC-KR; a page read as UTF-8 yields U+FFFD
 * replacement characters. Names collected that way are unreadable in the app.
 * This only reports — the repair is a separate, explicitly approved step.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";

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

/** Any replacement character at all is a decode failure in a product name. */
function isBroken(value) {
  return typeof value === "string" && value.includes("�");
}

const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) {
  console.error("[scan:mojibake] FAIL: Staging URL / service role key missing");
  process.exit(1);
}
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
if (ref === PROD_REF) {
  console.error("[scan:mojibake] FAIL: refusing to scan Production");
  process.exit(1);
}
console.log(
  `[scan:mojibake] target ${ref.slice(0, 4)}***${ref.slice(-3)} (read-only)`
);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: products, error } = await admin
  .from("products")
  .select("id, name, name_ko, name_ja, brand, slug")
  .limit(1000);
if (error) {
  console.error(`[scan:mojibake] FAIL: ${error.message}`);
  process.exit(1);
}

const { data: offers } = await admin
  .from("product_offers")
  .select("product_id, purchase_url, is_official, active")
  .eq("is_official", true)
  .limit(1000);

const officialByProduct = new Map();
for (const offer of offers ?? []) {
  if (offer.active === false) continue;
  if (!officialByProduct.has(Number(offer.product_id))) {
    officialByProduct.set(Number(offer.product_id), offer.purchase_url);
  }
}

const broken = [];
for (const product of products ?? []) {
  const fields = [];
  if (isBroken(product.name)) fields.push("name");
  if (isBroken(product.name_ko)) fields.push("name_ko");
  if (isBroken(product.name_ja)) fields.push("name_ja");
  if (isBroken(product.brand)) fields.push("brand");
  if (fields.length === 0) continue;
  broken.push({
    id: product.id,
    brand: product.brand,
    name: product.name,
    nameKo: product.name_ko,
    slug: product.slug,
    brokenFields: fields,
    officialUrl: officialByProduct.get(Number(product.id)) ?? null,
  });
}

console.log(`[scan:mojibake] scanned ${products?.length ?? 0} products`);
console.log(`[scan:mojibake] broken: ${broken.length}`);
console.log("");
for (const row of broken) {
  console.log(`  #${row.id} [${row.brokenFields.join(",")}] ${row.brand}`);
  console.log(`      name: ${JSON.stringify(row.name)}`);
  console.log(`      url : ${row.officialUrl ?? "(no official offer url)"}`);
}

const withoutUrl = broken.filter((row) => !row.officialUrl).length;
console.log("");
console.log(
  `[scan:mojibake] repairable from an official page: ${broken.length - withoutUrl} · no official url: ${withoutUrl}`
);
await new Promise((r) => setTimeout(r, 50));
process.exit(0);

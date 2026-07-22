import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";

function loadEnv(name) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
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

function extractRef(url) {
  const m = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m?.[1] ?? "";
}

function mask(ref) {
  if (!ref || ref.length < 8) return String(ref || "");
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

const env = {
  ...loadEnv(".env.staging"),
  ...loadEnv(".env.preview.staging"),
  ...loadEnv(".env.local"),
};
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const ref = extractRef(url);
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

console.log(
  JSON.stringify(
    {
      ref_masked: mask(ref),
      is_staging: ref === STAGING_REF,
      is_production: ref === PROD_REF,
      has_service_key: Boolean(key),
    },
    null,
    2
  )
);

if (ref === PROD_REF) {
  console.error("ABORT: Production ref");
  process.exit(2);
}
if (ref !== STAGING_REF) {
  console.error("ABORT: unexpected ref");
  process.exit(2);
}
if (!key) {
  console.error("ABORT: missing service role key");
  process.exit(2);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const slugs = [
  "aestura-atobarrier365-cream",
  "round-lab-dokdo-cream",
  "torriden-dive-in-serum",
  "skin1004-madagascar-centella-ampoule",
  "beauty-of-joseon-green-plum-refreshing-toner",
  "haruharu-wonder-black-rice-hyaluronic-toner",
  "cosrx-advanced-snail-92-all-in-one-cream",
];

const { data: products, error } = await client
  .from("products")
  .select(
    "id,slug,brand,name,name_ko,category,active,verified_at,data_confidence,key_ingredients,full_ingredients"
  )
  .in("slug", slugs);

if (error) {
  console.error("products_error", error.message);
  process.exit(1);
}

console.log(
  "found",
  (products || []).map((p) => ({
    id: p.id,
    slug: p.slug,
    active: p.active,
    verified: Boolean(p.verified_at),
    keys: (p.key_ingredients || []).slice(0, 6),
    full_count: (p.full_ingredients || []).length,
    category: p.category,
  }))
);

const sample = (products || []).find(
  (p) => p.slug === "cosrx-advanced-snail-92-all-in-one-cream"
);
if (sample) {
  const { data: offers } = await client
    .from("product_offers")
    .select(
      "id,product_id,retailer_name,retailer_country,ships_to_countries,purchase_url,price,currency,stock_status,verification_status,is_official,verified_at,last_checked_at,active,source"
    )
    .eq("product_id", sample.id)
    .limit(3);
  console.log("sample_offers", offers);

  const mediaTables = ["catalog_product_media", "product_media", "product_images"];
  for (const table of mediaTables) {
    const { data, error: mediaErr } = await client
      .from(table)
      .select("*")
      .eq("product_id", sample.id)
      .limit(2);
    console.log(
      `media_${table}`,
      mediaErr ? `ERR:${mediaErr.message}` : data
    );
  }

  const { data: one } = await client
    .from("products")
    .select("*")
    .eq("id", sample.id)
    .maybeSingle();
  console.log("product_cols", one ? Object.keys(one).sort() : []);
}

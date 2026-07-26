import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

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
    )
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
function extractRef(url) {
  return (String(url).match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
}

const env = {
  ...loadEnv(".env.staging"),
  ...loadEnv(".env.preview.staging"),
  ...loadEnv(".env.local"),
};
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = extractRef(url);
if (ref === PROD_REF) throw new Error("PROD");
if (ref !== STAGING_REF) throw new Error("bad ref " + ref);
const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const slugs = [
  "cosrx-advanced-snail-92-all-in-one-cream",
  "cosrx-advanced-snail-96-mucin-power-essence",
  "aestura-atobarrier365-cream",
  "round-lab-dokdo-cream",
  "torriden-dive-in-serum",
  "beauty-of-joseon-glow-serum-propolis-niacinamide",
  "skin1004-madagascar-centella-ampoule",
  "cosrx-aha-bha-clarifying-treatment-toner",
  "anua-heartleaf-77-soothing-toner",
  "beauty-of-joseon-green-plum-refreshing-toner",
  "round-lab-dokdo-toner",
  "haruharu-wonder-black-rice-hyaluronic-toner",
];

const { data: products, error } = await client
  .from("products")
  .select("id,slug,active,verified_at,key_ingredients,brand,name")
  .in("slug", slugs);
if (error) throw error;
const found = new Map((products || []).map((p) => [p.slug, p]));
const ids = (products || []).map((p) => p.id);
const { data: offers } = ids.length
  ? await client
      .from("product_offers")
      .select(
        "product_id,retailer_country,stock_status,verification_status,price,currency,active,purchase_url"
      )
      .in("product_id", ids)
      .eq("retailer_country", "KR")
  : { data: [] };

const offersByPid = new Map();
for (const o of offers || []) {
  const list = offersByPid.get(o.product_id) || [];
  list.push(o);
  offersByPid.set(o.product_id, list);
}

const rows = slugs.map((slug) => {
  const p = found.get(slug);
  if (!p) return { slug, exists: false };
  const offs = offersByPid.get(p.id) || [];
  const eligible = offs.filter(
    (o) =>
      o.active &&
      o.verification_status === "verified" &&
      o.stock_status === "in_stock" &&
      o.currency === "KRW" &&
      Number(o.price) > 0
  );
  return {
    slug,
    exists: true,
    id: p.id,
    active: p.active,
    verified: Boolean(p.verified_at),
    keys: p.key_ingredients,
    krEligibleOffers: eligible.length,
  };
});

console.log(JSON.stringify({ ref: ref.slice(0, 4) + "***" + ref.slice(-3), rows }, null, 2));

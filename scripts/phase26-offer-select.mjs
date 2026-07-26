import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
function load(n) {
  const p = path.join(ROOT, n);
  if (!fs.existsSync(p)) return {};
  const o = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    o[m[1]] = v;
  }
  return o;
}
const env = {
  ...load(".env.staging"),
  ...load(".env.preview.staging"),
  ...load(".env.local"),
};
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const key =
  env.SUPABASE_SERVICE_ROLE_KEY || env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1];
if (ref !== "jfnjufmldiqlgvgyugfd") throw new Error("bad ref " + ref);
const sb = createClient(url, key, { auth: { persistSession: false } });
const slugs = [
  "beauty-of-joseon-green-plum-refreshing-toner",
  "haruharu-wonder-black-rice-hyaluronic-toner",
  "cosrx-aha-bha-clarifying-treatment-toner",
  "anua-heartleaf-77-soothing-toner",
];
const { data: ps, error: pe } = await sb
  .from("products")
  .select("id,slug,name_ko,brand")
  .in("slug", slugs);
if (pe) throw pe;
const ids = (ps || []).map((p) => p.id);
const { data: os, error: oe } = await sb
  .from("product_offers")
  .select(
    "id,product_id,retailer_name,retailer_country,stock_status,verification_status,is_official,price,currency,purchase_url,last_checked_at,verified_at,active"
  )
  .in("product_id", ids);
if (oe) throw oe;
const out = {
  ref: "jfnj***gfd",
  products: ps,
  offers: (os || []).map((o) => ({
    id: o.id,
    product_id: o.product_id,
    slug: (ps || []).find((p) => String(p.id) === String(o.product_id))?.slug,
    retailer_name: o.retailer_name,
    retailer_country: o.retailer_country,
    stock_status: o.stock_status,
    verification_status: o.verification_status,
    is_official: o.is_official,
    price: o.price,
    currency: o.currency,
    active: o.active,
    last_checked_at: o.last_checked_at,
    verified_at: o.verified_at,
    purchase_url_host: (() => {
      try {
        return new URL(o.purchase_url).host;
      } catch {
        return null;
      }
    })(),
  })),
};
fs.writeFileSync(
  path.join(
    ROOT,
    "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase26-offer-select.json"
  ),
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out, null, 2));

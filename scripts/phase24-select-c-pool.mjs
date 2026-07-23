import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function load(n) {
  const p = path.join(process.cwd(), n);
  if (!fs.existsSync(p)) return {};
  const o = {};
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
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

const e = { ...load(".env.staging"), ...load(".env.local") };
const u = e.NEXT_PUBLIC_SUPABASE_URL;
const r = (u.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1];
if (r !== "jfnjufmldiqlgvgyugfd") throw new Error("bad ref " + r);
const c = createClient(u, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const slugs = [
  "cosrx-aha-bha-clarifying-treatment-toner",
  "some-by-mi-aha-bha-pha-30-days-miracle-toner",
  "anua-heartleaf-77-soothing-toner",
  "beauty-of-joseon-green-plum-refreshing-toner",
  "isntree-green-tea-fresh-toner",
  "round-lab-dokdo-toner",
  "pyunkang-yul-essence-toner",
  "haruharu-wonder-black-rice-hyaluronic-toner",
  "celimax-dual-barrier-creamy-toner",
  "numbuzin-no3-super-glowing-essence-toner",
];

const { data: ps, error } = await c
  .from("products")
  .select("id,slug,brand,name,active,key_ingredients,verified_at")
  .in("slug", slugs);
if (error) throw error;
const ids = (ps || []).map((p) => p.id);
const { data: os } = await c
  .from("product_offers")
  .select(
    "id,product_id,retailer_name,price,currency,stock_status,verification_status,is_official,purchase_url,active"
  )
  .in("product_id", ids);
const byId = Object.fromEntries((ps || []).map((p) => [p.id, p]));
const summary = (os || []).map((o) => ({
  slug: byId[o.product_id]?.slug,
  brand: byId[o.product_id]?.brand,
  ...o,
}));
const missing = slugs.filter((s) => !(ps || []).some((p) => p.slug === s));
console.log(
  JSON.stringify(
    {
      ref: r.slice(0, 4) + "***" + r.slice(-3),
      productCount: (ps || []).length,
      missing,
      products: ps,
      offers: summary,
    },
    null,
    2
  )
);

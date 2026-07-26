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
if (r === "rhfrmvkjsummaylpzmns") throw new Error("PROD");
if (r !== "jfnjufmldiqlgvgyugfd") throw new Error("bad ref");
const c = createClient(u, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const slugs = [
  "beauty-of-joseon-green-plum-refreshing-toner",
  "haruharu-wonder-black-rice-hyaluronic-toner",
];
const { data: ps, error } = await c
  .from("products")
  .select("id,slug,brand,name,name_ko,active,verified_at,key_ingredients")
  .in("slug", slugs);
if (error) throw error;
const ids = (ps || []).map((p) => p.id);
const { data: os } = await c.from("product_offers").select("*").in("product_id", ids);
console.log(
  JSON.stringify(
    { ref: r.slice(0, 4) + "***" + r.slice(-3), products: ps, offers: os },
    null,
    2
  )
);

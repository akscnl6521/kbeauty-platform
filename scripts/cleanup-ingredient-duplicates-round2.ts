/**
 * Cleanup pass 2: the 7 multi-shadow groups from round 1 are all cases where
 * a compound slash-separated INCI name got split into meaningless fragment
 * rows (e.g. "코코 카프릴레이트" / "카프레이트" as separate rows instead of
 * the correct compound "코코-카프릴레이트/카프레이트"). In every case the
 * canonical (lowest-id) row already has the correct full name_ko. Delete all
 * non-canonical rows for these 7 name_en groups; no name_ko updates needed.
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

const TARGET_NAMES = [
  "titanium dioxide (ci 77891)",
  "bis-behenyl/isostearyl/phytosteryl dimer dilinoleyl dimer dilinoleate",
  "cetyl peg/ppg-10/1 dimethicone",
  "coco-caprylate/caprate",
  "hydrolyzed keratin",
  "methoxy peg-114/polyepsilon caprolactone",
  "peg-240/hdi copolymer bis-decyltetradeceth-20 ether",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await client
    .from("ingredients")
    .select("id, slug, name_en, name_ko")
    .order("id", { ascending: true })
    .limit(5000);
  if (error) throw error;

  let deleted = 0;
  for (const target of TARGET_NAMES) {
    const rows = (data ?? []).filter(
      (r) => (r.name_en ?? "").toLowerCase().trim() === target
    );
    if (rows.length < 2) {
      console.warn(`[skip] ${target}: found ${rows.length} rows, expected >=2`);
      continue;
    }
    const canonical = rows.reduce((a, b) => (a.id < b.id ? a : b));
    if (!canonical.name_ko) {
      console.warn(`[skip] ${target}: canonical id=${canonical.id} has no name_ko, refusing to delete siblings blind`);
      continue;
    }
    const shadows = rows.filter((r) => r.id !== canonical.id);
    for (const s of shadows) {
      const { error: delErr } = await client.from("ingredients").delete().eq("id", s.id);
      if (delErr) {
        console.error(`[delete-fail] id=${s.id}`, delErr.message);
        continue;
      }
      deleted += 1;
    }
    console.log(`[done] ${target}: kept id=${canonical.id}, deleted ${shadows.length}`);
  }

  console.log(JSON.stringify({ deleted }, null, 2));
}

main().catch((err) => {
  console.error("[cleanup-ingredient-duplicates-round2] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

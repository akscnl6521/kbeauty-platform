/**
 * One-time cleanup: remove the 296 duplicate "-nk" suffixed ingredient rows
 * created by a background agent this session (see DASHBOARD.md §14). Each
 * duplicate carries a real name_ko value that belongs on the canonical
 * (lowest-id) row for that name_en. Never deletes a row with no duplicate;
 * never invents any name_ko value — only copies what the duplicate already
 * had.
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

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

  const byNameEn = new Map<string, { id: number; slug: string; name_ko: string | null }[]>();
  for (const row of data ?? []) {
    const key = (row.name_en ?? "").toLowerCase().trim();
    if (!key) continue;
    const arr = byNameEn.get(key) ?? [];
    arr.push(row);
    byNameEn.set(key, arr);
  }
  const dups = [...byNameEn.entries()].filter(([, v]) => v.length > 1);

  let updatedNameKo = 0;
  let deleted = 0;
  let skippedMultiShadow = 0;

  for (const [nameEn, group] of dups) {
    const canonical = group.reduce((a, b) => (a.id < b.id ? a : b));
    const shadows = group.filter((g) => g.id !== canonical.id);
    if (shadows.length > 1) {
      // Defensive: only expected 1 shadow per group based on inspection; if more, skip and report.
      skippedMultiShadow += 1;
      console.warn(`[skip] ${nameEn}: expected 1 shadow, found ${shadows.length}`);
      continue;
    }
    const shadow = shadows[0]!;

    if (!canonical.name_ko && shadow.name_ko) {
      const { error: upErr } = await client
        .from("ingredients")
        .update({ name_ko: shadow.name_ko })
        .eq("id", canonical.id);
      if (upErr) {
        console.error(`[update-fail] id=${canonical.id}`, upErr.message);
        continue;
      }
      updatedNameKo += 1;
    }

    const { error: delErr } = await client.from("ingredients").delete().eq("id", shadow.id);
    if (delErr) {
      console.error(`[delete-fail] id=${shadow.id}`, delErr.message);
      continue;
    }
    deleted += 1;
  }

  console.log(
    JSON.stringify(
      { totalDupGroups: dups.length, updatedNameKo, deleted, skippedMultiShadow },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("[cleanup-ingredient-duplicates] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

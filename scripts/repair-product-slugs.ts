/**
 * Regenerate product slugs from the correct product name.
 *
 * Scope by default is the five rows whose names were repaired in
 * data/backups/<day>/product-name-repair.json — their slugs were derived from
 * the corrupted names and identify nothing. `--all` widens to every product with
 * a degraded slug (see the report that flag prints before writing).
 *
 * Same safety shape as the name repair:
 *   - the new slug must keep the brand and every size/pack token from the name,
 *     otherwise it no longer distinguishes this row from its siblings and the
 *     row is skipped (validateSlugReplacement)
 *   - uniqueness is checked against every existing slug before writing
 *   - the change is audited to product_change_history BEFORE products is touched
 *   - a JSON backup is written to disk first
 *
 *   npm run catalog:repair-slugs                 # dry run, the five name-repaired rows
 *   npm run catalog:repair-slugs -- --write      # apply
 *   npm run catalog:repair-slugs -- --all        # dry run over every degraded slug
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  ensureUniqueSlug,
  isDegradedSlug,
  slugifyKoreanProductName,
  validateSlugReplacement,
} from "../src/lib/catalog/enrichment/koreanProductSlug";
import { isMojibakeName } from "../src/lib/catalog/enrichment/productNameRepair";

const root = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const WRITE = process.argv.includes("--write");
const ALL = process.argv.includes("--all");

function loadEnvFile(name: string): Record<string, string> {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out: Record<string, string> = {};
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

/** Product ids whose names this repair already fixed. */
function nameRepairedIds(): number[] {
  const backups = path.join(root, "data", "backups");
  if (!existsSync(backups)) return [];
  const ids = new Set<number>();
  for (const day of readdirSync(backups)) {
    const file = path.join(backups, day, "product-name-repair.json");
    if (!existsSync(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      for (const change of parsed.changes ?? []) ids.add(Number(change.id));
    } catch {
      // a malformed backup should not block the run
    }
  }
  return [...ids];
}

type PlannedSlug = {
  id: number;
  brand: string;
  name: string;
  oldSlug: string | null;
  newSlug: string;
};

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    console.error("[repair:slugs] FAIL: Staging URL / service role key missing");
    process.exitCode = 1;
    return;
  }
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) ?? [])[1] ?? "";
  if (ref === PROD_REF) {
    console.error("[repair:slugs] FAIL: refusing to write to Production");
    process.exitCode = 1;
    return;
  }
  console.log(
    `[repair:slugs] target ${ref.slice(0, 4)}***${ref.slice(-3)} · mode ${WRITE ? "WRITE" : "dry run"} · scope ${ALL ? "all degraded" : "name-repaired rows"}`
  );

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: products, error } = await admin
    .from("products")
    .select("id, name, brand, slug")
    .limit(1000);
  if (error) {
    console.error(`[repair:slugs] FAIL: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const all = (products ?? []).map((p) => ({
    id: Number(p.id),
    name: String(p.name ?? ""),
    brand: String(p.brand ?? ""),
    slug: (p.slug as string | null) ?? null,
  }));

  const targetIds = new Set(nameRepairedIds());
  const candidates = ALL
    ? all.filter((p) => isDegradedSlug(p.brand, p.name, p.slug))
    : all.filter((p) => targetIds.has(p.id));

  if (!ALL && targetIds.size === 0) {
    console.error(
      "[repair:slugs] no product-name-repair backup found — nothing to scope to. Use --all to widen."
    );
    process.exitCode = 1;
    return;
  }

  // Report the wider picture regardless of scope, so a narrow run never hides it.
  const degradedTotal = all.filter((p) =>
    isDegradedSlug(p.brand, p.name, p.slug)
  ).length;
  console.log(
    `[repair:slugs] ${all.length} products · ${degradedTotal} have a degraded slug · this run considers ${candidates.length}`
  );
  console.log("");

  const takenSlugs = new Set(
    all.map((p) => p.slug).filter((slug): slug is string => Boolean(slug))
  );

  const planned: PlannedSlug[] = [];
  const skipped: Array<Record<string, unknown>> = [];

  for (const product of candidates) {
    if (isMojibakeName(product.name)) {
      skipped.push({ id: product.id, reason: "name_still_mojibake" });
      console.log(`  #${product.id} skip — name is still broken; repair the name first`);
      continue;
    }

    const generated = slugifyKoreanProductName(product.brand, product.name);
    const verdict = validateSlugReplacement(
      product.brand,
      product.name,
      product.slug,
      generated
    );
    if (!verdict.acceptable) {
      skipped.push({
        id: product.id,
        reason: verdict.reasons.join(","),
        candidate: generated,
      });
      console.log(`  #${product.id} skip — ${verdict.reasons.join(", ")}`);
      continue;
    }

    // uniqueness against everything currently in the table, minus this row's own
    const others = new Set(takenSlugs);
    if (product.slug) others.delete(product.slug);
    const unique = ensureUniqueSlug(generated, others, product.id);

    planned.push({
      id: product.id,
      brand: product.brand,
      name: product.name,
      oldSlug: product.slug,
      newSlug: unique,
    });
    takenSlugs.add(unique);

    console.log(`  #${product.id} ${product.name}`);
    console.log(`        ${product.slug ?? "(none)"}`);
    console.log(`      → ${unique}`);
  }

  console.log("");
  console.log(`[repair:slugs] ready to fix ${planned.length} · skipped ${skipped.length}`);

  if (!WRITE) {
    console.log("");
    console.log("[repair:slugs] dry run — pass --write to apply to Staging");
    return;
  }
  if (planned.length === 0) {
    console.log("[repair:slugs] nothing to write");
    return;
  }

  const stamp = new Date().toISOString();
  const day = stamp.slice(0, 10);
  const backupDir = path.join(root, "data", "backups", day);
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(
    path.join(backupDir, "product-slug-repair.json"),
    `${JSON.stringify(
      {
        appliedAt: stamp,
        environment: "staging",
        reason:
          "Slugs were generated by a slugifier that strips Hangul, so Korean product names produced slugs that identify nothing. Regenerated from the corrected name with Revised-Romanization transliteration.",
        scope: ALL ? "all_degraded" : "name_repaired_rows",
        changes: planned,
        skipped,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(
    `[repair:slugs] backup written: data/backups/${day}/product-slug-repair.json`
  );

  let audited = 0;
  let updated = 0;
  let failed = 0;

  for (const change of planned) {
    const { error: auditError } = await admin.from("product_change_history").insert({
      product_id: change.id,
      variant_id: null,
      // slug is not a name/price/status change; 'other' is the honest bucket
      change_type: "other",
      old_value: { slug: change.oldSlug },
      new_value: {
        slug: change.newSlug,
        action: "slug_regeneration",
        basis: "product name",
        romanization: "revised_transliteration",
        productName: change.name,
      },
      source_url: null,
      approved_by: null,
      reviewed_at: null,
    });
    if (auditError) {
      failed += 1;
      console.error(`  ! #${change.id} audit failed: ${auditError.message.slice(0, 80)}`);
      console.error("    slug left unchanged (audit must precede the write)");
      continue;
    }
    audited += 1;

    const { error: updateError } = await admin
      .from("products")
      .update({ slug: change.newSlug })
      .eq("id", change.id);
    if (updateError) {
      failed += 1;
      console.error(
        `  ! #${change.id} update failed: ${updateError.message.slice(0, 80)}`
      );
      continue;
    }
    updated += 1;
    console.log(`  ✓ #${change.id} ${change.newSlug}`);
  }

  // --- verify by reading back ------------------------------------------------
  const { data: after } = await admin
    .from("products")
    .select("id, name, brand, slug")
    .limit(1000);

  let mismatched = 0;
  let stillDegraded = 0;
  for (const change of planned) {
    const row = (after ?? []).find((r) => Number(r.id) === change.id);
    if (!row) continue;
    if (row.slug !== change.newSlug) mismatched += 1;
    else if (
      isDegradedSlug(String(row.brand ?? ""), String(row.name ?? ""), row.slug as string)
    ) {
      stillDegraded += 1;
    }
  }
  const slugCounts = new Map<string, number>();
  for (const row of after ?? []) {
    const slug = (row.slug as string | null) ?? "";
    slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  }
  const duplicates = [...slugCounts.entries()].filter(([, count]) => count > 1);

  console.log("");
  console.log(`[repair:slugs] audited ${audited} · updated ${updated} · failed ${failed}`);
  console.log(
    `[repair:slugs] verify: unexpected value ${mismatched} · still degraded ${stillDegraded} · duplicate slugs ${duplicates.length}`
  );
  if (duplicates.length > 0) {
    console.error(
      `  duplicates: ${duplicates.map(([slug, count]) => `${slug}(${count})`).join(", ")}`
    );
  }
  if (mismatched > 0 || stillDegraded > 0 || failed > 0 || duplicates.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(
    "[repair:slugs] DONE — slugs regenerated, every change recorded in product_change_history"
  );
}

main().catch((error) => {
  console.error("[repair:slugs] failed:", error);
  process.exitCode = 1;
});

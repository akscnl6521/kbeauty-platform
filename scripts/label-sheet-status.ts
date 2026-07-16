/**
 * Staging label-sheet coverage report (read-only SQL).
 * npm run catalog:labels:status
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadOfficialInciSheetFromDisk } from "@/lib/admin/catalogLabelSheetDisk";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();

function assertStaging() {
  const linked = readFileSync(
    path.join(root, "supabase/.temp/project-ref"),
    "utf8"
  ).trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
  return linked;
}

function q(sql: string) {
  const dir = path.join(root, "data/catalog/labels/_tmp");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, "status.sql");
  writeFileSync(f, sql, "utf8");
  const r = spawnSync(
    "npx.cmd",
    ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
      timeout: 120000,
    }
  );
  const out = r.stdout || "";
  if ((r.status ?? 1) !== 0) throw new Error((r.stderr || out).slice(-800));
  const i = out.indexOf("{");
  return i >= 0 ? JSON.parse(out.slice(i)) : {};
}

function main() {
  const linked = assertStaging();
  const sheet = loadOfficialInciSheetFromDisk();
  const sprint = sheet._meta.sprintTagDefault;
  const counts = q(`
SELECT
  count(*) FILTER (WHERE sprint_tag='${sprint}' AND product_status<>'rejected')::int AS heroes,
  count(*) FILTER (WHERE sprint_tag='${sprint}' AND ingredients_status='raw_collected')::int AS with_inci,
  count(*) FILTER (WHERE sprint_tag='${sprint}' AND match_class='official_matched')::int AS official_matched,
  count(*) FILTER (WHERE sprint_tag='${sprint}' AND recommendable=true)::int AS recommendable,
  count(*) FILTER (WHERE sprint_tag='${sprint}' AND jsonb_array_length(COALESCE(evidence_ingredient_slugs,'[]'::jsonb))>0)::int AS evidence_linked
FROM catalog_staging_products;
`);
  const report = {
    phase: "label_sheet_status",
    linked,
    productionTouched: false,
    sheet: {
      entries: sheet.entries.length,
      applyReady: sheet.entries.filter((e) => e.applyReady).length,
      needsReviewWithTokens: sheet.entries.filter(
        (e) =>
          !e.applyReady &&
          ((e.fullIngredients?.length ?? 0) >= 3 ||
            (e.fullIngredientsRaw?.split(",").length ?? 0) >= 3)
      ).length,
      emptyPending: sheet.entries.filter(
        (e) =>
          !e.applyReady &&
          !(e.fullIngredients?.length ?? 0) &&
          !(e.fullIngredientsRaw?.trim())
      ).length,
    },
    staging: counts.rows?.[0] ?? null,
  };
  writeFileSync(
    path.join(root, "data/catalog/labels/latest-status.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report));
}

main();

/**
 * Harvest Open Beauty Facts INCI for Staging heroes missing ingredients.
 * Only keeps brand-matched + INCI-looking lists. Never invents.
 * Writes data/catalog/labels/obf-inci-sheet.v1.json and merges into official sheet.
 * npm run catalog:labels:obf
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { OfficialInciLabelEntry, OfficialInciLabelSheet } from "@/lib/catalog/labels";
import {
  loadOfficialInciLabelSheet,
  validateOfficialInciLabelSheet,
} from "@/lib/catalog/labels";
import { looksLikeInciListText } from "@/lib/catalog/labels/looksLikeInci";
import {
  obfSearch,
  obfFetchProduct,
  brandMatches,
  nameSimilarity,
  buildObfSearchTerms,
  hasFormConflict,
  pickSearchProductName,
} from "@/lib/catalog/labels/obfClient";
import { parseOfficialIngredientsRaw } from "@/lib/catalog/automation/ingredientParser";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "labels", `obf-${stamp}`);
const DELAY_MS = 450;
const MIN_NAME_SIM = 0.28;
const MIN_APPLY_SIM = 0.55;

function assertStaging() {
  const linked = readFileSync(
    path.join(root, "supabase/.temp/project-ref"),
    "utf8"
  ).trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
  return linked;
}

function sqlEscape(s: string) {
  return s.replace(/'/g, "''");
}

function q(label: string, sql: string) {
  mkdirSync(path.join(outDir, "sql"), { recursive: true });
  const f = path.join(outDir, "sql", `${label}.sql`);
  writeFileSync(f, sql, "utf8");
  const r = spawnSync(
    "npx.cmd",
    ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
      timeout: 180000,
    }
  );
  const out = r.stdout || "";
  if ((r.status ?? 1) !== 0) {
    throw new Error(`${label}: ${(r.stderr || out).slice(-800)}`);
  }
  const i = out.indexOf("{");
  return i >= 0 ? JSON.parse(out.slice(i)) : {};
}

type Hero = {
  external_product_id: string;
  brand_canonical: string;
  product_name_en: string | null;
  product_name_raw: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const linked = assertStaging();
  mkdirSync(outDir, { recursive: true });
  const sheet = loadOfficialInciLabelSheet();
  const sprint = sheet._meta.sprintTagDefault;

  const loaded = q(
    "01-missing",
    `
SELECT external_product_id, brand_canonical, product_name_en, product_name_raw
FROM catalog_staging_products
WHERE sprint_tag='${sqlEscape(sprint)}'
  AND product_status <> 'rejected'
  AND ingredients_status = 'not_found'
ORDER BY brand_canonical, external_product_id;
`
  );
  const heroes = (loaded.rows ?? []) as Hero[];
  console.error(`[1] missing INCI heroes=${heroes.length}`);

  const harvested: OfficialInciLabelEntry[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];
  let searched = 0;

  for (const h of heroes) {
    const name = pickSearchProductName(h.product_name_en, h.product_name_raw)
      .replace(/\(discovery candidate\)/gi, "")
      .trim();
    const terms = buildObfSearchTerms(h.brand_canonical, name);
    searched += 1;
    console.error(`[obf ${searched}/${heroes.length}] ${h.external_product_id}`);
    try {
      let hits: Awaited<ReturnType<typeof obfSearch>> = [];
      for (const term of terms) {
        hits = await obfSearch(term, 5);
        await sleep(DELAY_MS);
        if (hits.length) break;
      }
      let best: OfficialInciLabelEntry | null = null;
      let bestScore = 0;

      for (const hit of hits) {
        if (!brandMatches(h.brand_canonical, hit.brands)) {
          continue;
        }
        const sim = nameSimilarity(name, hit.productName);
        if (sim < MIN_NAME_SIM) continue;
        // Include external id for form hints (e.g. …-balm…)
        if (hasFormConflict(`${name} ${h.external_product_id}`, hit.productName)) {
          rejected.push({
            id: h.external_product_id,
            reason: `form_conflict:${hit.code}:${hit.productName}`,
          });
          continue;
        }

        const detail = await obfFetchProduct(hit.code);
        await sleep(DELAY_MS);
        if (!detail?.ingredientsText) continue;
        if (!looksLikeInciListText(detail.ingredientsText)) {
          rejected.push({
            id: h.external_product_id,
            reason: `not_inci_like:${hit.code}`,
          });
          continue;
        }

        const tokens = parseOfficialIngredientsRaw({
          ingredientsRaw: detail.ingredientsText,
          sourceUrl: detail.url,
          sourceType: "open_beauty_facts",
          sourceTier: 3,
          sourceVerified: false,
        }).tokens.map((t) => t.inciName || t.ingredientRaw);

        if (tokens.length < 5) continue;
        if (sim > bestScore) {
          bestScore = sim;
          const applyReady = sim >= MIN_APPLY_SIM;
          best = {
            externalProductId: h.external_product_id,
            brandCanonical: h.brand_canonical,
            productNameEn: name,
            sourceType: "open_beauty_facts",
            sourceUrl: detail.url,
            labelCheckedAt: new Date().toISOString().slice(0, 10),
            labelLanguage: "en",
            fullIngredientsRaw: detail.ingredientsText,
            fullIngredients: tokens,
            notes: `OBF code ${detail.code}; nameSim=${sim.toFixed(2)}; crowd-sourced open data (tier3) — re-check vs official label.${
              applyReady ? "" : " applyReady=false (low name similarity)."
            }`,
            applyReady,
          };
        }
      }

      if (best) harvested.push(best);
      else
        rejected.push({
          id: h.external_product_id,
          reason: hits.length ? "no_qualified_match" : "no_hits",
        });
    } catch (e) {
      rejected.push({
        id: h.external_product_id,
        reason: `error:${e instanceof Error ? e.message : "unknown"}`,
      });
    }
  }

  const obfSheet: OfficialInciLabelSheet = {
    _meta: {
      sheetVersion: 1,
      rule: "OBF harvest only — never invent; require brand match + INCI-like list.",
      sprintTagDefault: sprint,
      builtAt: new Date().toISOString(),
      sourcesNote: "Open Beauty Facts (catalog_sources approved open_data)",
    },
    entries: harvested,
  };
  const v = validateOfficialInciLabelSheet(obfSheet);
  if (!v.ok) throw new Error(`OBF sheet invalid: ${JSON.stringify(v.issues)}`);

  const obfPath = path.join(
    root,
    "data/catalog/labels/obf-inci-sheet.v1.json"
  );
  writeFileSync(obfPath, JSON.stringify(obfSheet, null, 2), "utf8");

  // Merge into official sheet (replace same id if from OBF / fill missing only)
  const mainPath = path.join(
    root,
    "data/catalog/labels/official-inci-sheet.v1.json"
  );
  const main = existsSync(mainPath)
    ? (JSON.parse(readFileSync(mainPath, "utf8")) as OfficialInciLabelSheet)
    : sheet;
  const byId = new Map(main.entries.map((e) => [e.externalProductId, e]));
  for (const e of harvested) {
    const prev = byId.get(e.externalProductId);
    if (prev?.applyReady && prev.sourceType !== "open_beauty_facts") {
      // Prefer official brand page / staging verified over OBF
      continue;
    }
    byId.set(e.externalProductId, e);
  }
  main.entries = [...byId.values()];
  main._meta.builtAt = new Date().toISOString();
  main._meta.sourcesNote = [
    main._meta.sourcesNote,
    `+ OBF harvest ${harvested.length}`,
  ]
    .filter(Boolean)
    .join(" ");
  const mv = validateOfficialInciLabelSheet(main);
  if (!mv.ok) throw new Error(`merged sheet invalid: ${JSON.stringify(mv.issues)}`);
  writeFileSync(mainPath, JSON.stringify(main, null, 2), "utf8");

  const manifest = {
    phase: "obf_inci_harvest",
    stamp,
    linked,
    productionTouched: false,
    searched,
    harvested: harvested.length,
    ids: harvested.map((e) => e.externalProductId),
    rejectedSample: rejected.slice(0, 20),
    rejectedTotal: rejected.length,
  };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(
    path.join(root, "data/catalog/labels/latest-obf-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  writeFileSync(
    path.join(outDir, "rejected.json"),
    JSON.stringify(rejected, null, 2)
  );
  console.log(JSON.stringify(manifest));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

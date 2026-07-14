#!/usr/bin/env node
/** Staging-only: apply evidence seed + verify counts. */
import { readFileSync, copyFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const linked = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
console.log(JSON.stringify({ linked }));
if (linked === PROD) {
  console.error("ABORT_PRODUCTION");
  process.exit(2);
}
if (linked !== STAGING) {
  console.error("ABORT_NOT_STAGING");
  process.exit(2);
}

function q(sql) {
  const f = path.join(tmpdir(), `kb-evq-${process.pid}-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(f, sql, "utf8");
  try {
    const r = spawnSync(
      "npx.cmd",
      ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    const out = r.stdout || "";
    const i = out.indexOf("{");
    if ((r.status ?? 1) !== 0) {
      console.error((r.stderr || out).slice(-800));
      process.exit(r.status ?? 1);
    }
    return i >= 0 ? JSON.parse(out.slice(i)) : {};
  } finally {
    try {
      unlinkSync(f);
    } catch {}
  }
}

const applySrc = path.join(
  root,
  "supabase/migrations/20260714090000_seed_evidence_layer_staging.sql"
);
const applyDst = path.join(tmpdir(), `kb-ev-apply-${process.pid}.sql`);
copyFileSync(applySrc, applyDst);
try {
  const r = spawnSync(
    "npx.cmd",
    ["supabase", "db", "query", "--linked", "--file", applyDst],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  console.log("APPLY", r.status);
  console.log((r.stdout || "").slice(-300));
  if ((r.status ?? 1) !== 0) {
    console.error((r.stderr || "").slice(-800));
    process.exit(r.status ?? 1);
  }
} finally {
  try {
    unlinkSync(applyDst);
  } catch {}
}

const concerns = q(
  `SELECT code, review_status, active FROM skin_concerns WHERE code IN ('redness','dryness','sensitivity') ORDER BY code;`
);
const ev = q(
  `SELECT count(*)::int AS n FROM ingredient_evidence WHERE review_status='approved' AND reviewed_at IS NOT NULL;`
);
const sample = q(
  `SELECT e.pmid, e.evidence_level, i.slug AS ingredient_slug, c.code AS concern_code
   FROM ingredient_evidence e
   JOIN ingredients i ON i.id = e.ingredient_id
   JOIN skin_concerns c ON c.id = e.concern_id
   WHERE e.review_status='approved'
   ORDER BY c.code, i.slug
   LIMIT 20;`
);
console.log("CONCERNS", JSON.stringify(concerns.rows));
console.log("EV_COUNT", JSON.stringify(ev.rows));
console.log("SAMPLE", JSON.stringify(sample.rows));
console.log(JSON.stringify({ phase: "evidence_seed_ok", linked }));

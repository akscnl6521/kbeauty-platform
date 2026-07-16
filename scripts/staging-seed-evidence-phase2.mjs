#!/usr/bin/env node
/** Staging-only: apply Evidence phase-2 acne seed. */
import { readFileSync, copyFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const linked = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
if (linked === PROD) {
  console.error("ABORT_PRODUCTION");
  process.exit(2);
}
if (linked !== STAGING) {
  console.error("ABORT_NOT_STAGING");
  process.exit(2);
}
console.log(JSON.stringify({ linked }));

function q(sql) {
  const f = path.join(tmpdir(), `kb-p2-${process.pid}.sql`);
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
      console.error((r.stderr || out).slice(-600));
      process.exit(r.status ?? 1);
    }
    return i >= 0 ? JSON.parse(out.slice(i)) : {};
  } finally {
    try {
      unlinkSync(f);
    } catch {}
  }
}

const src = path.join(
  root,
  "supabase/migrations/20260714091000_seed_evidence_layer_phase2_acne.sql"
);
const dst = path.join(tmpdir(), `kb-p2-apply-${process.pid}.sql`);
copyFileSync(src, dst);
try {
  const r = spawnSync(
    "npx.cmd",
    ["supabase", "db", "query", "--linked", "--file", dst],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  console.log("APPLY", r.status);
  if ((r.status ?? 1) !== 0) {
    console.error((r.stderr || "").slice(-600));
    process.exit(r.status ?? 1);
  }
} finally {
  try {
    unlinkSync(dst);
  } catch {}
}

const concerns = q(
  `SELECT code, review_status FROM skin_concerns WHERE code IN ('redness','dryness','sensitivity','acne') ORDER BY code;`
);
const count = q(
  `SELECT count(*)::int AS n FROM ingredient_evidence WHERE review_status='approved';`
);
console.log("CONCERNS", JSON.stringify(concerns.rows));
console.log("EV_COUNT", JSON.stringify(count.rows));
console.log(JSON.stringify({ phase: "evidence_phase2_seed_ok" }));

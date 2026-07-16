#!/usr/bin/env node
/** Staging-only read of evidence schema state. */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
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
  const f = path.join(tmpdir(), `kb-ev-${process.pid}-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(f, sql, "utf8");
  try {
    const r = spawnSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
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
    if (i < 0) return { err: (r.stderr || out).slice(-400) };
    return JSON.parse(out.slice(i));
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

console.log(
  "cols",
  JSON.stringify(
    q(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ingredient_evidence'
       ORDER BY ordinal_position`
    ).rows
  )
);
console.log(
  "concerns",
  JSON.stringify(q(`SELECT id, code, name_en, name_ko, active, review_status FROM skin_concerns ORDER BY id LIMIT 40`).rows)
);
console.log("ev_count", JSON.stringify(q(`SELECT count(*)::int AS n FROM ingredient_evidence`).rows));
console.log(
  "ings",
  JSON.stringify(
    q(`SELECT id, name, name_ko FROM ingredients
       WHERE name ILIKE '%panthenol%' OR name ILIKE '%niacinamide%'
          OR name ILIKE '%centella%' OR name ILIKE '%ceramide%'
          OR name ILIKE '%hyaluron%' OR name ILIKE '%allantoin%'
          OR coalesce(name_ko,'') ILIKE '%판테놀%'
          OR coalesce(name_ko,'') ILIKE '%나이아신%'
       ORDER BY id LIMIT 30`).rows
  )
);

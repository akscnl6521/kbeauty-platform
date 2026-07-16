#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const linked = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (linked !== "jfnjufmldiqlgvgyugfd") {
  console.error("ABORT", linked);
  process.exit(2);
}
function q(sql) {
  const f = path.join(tmpdir(), `kb-${process.pid}.sql`);
  writeFileSync(f, sql, "utf8");
  try {
    const r = spawnSync(
      "npx.cmd",
      ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
      {
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    const out = r.stdout || "";
    const i = out.indexOf("{");
    return i >= 0 ? JSON.parse(out.slice(i)) : { err: (r.stderr || out).slice(-300) };
  } finally {
    try {
      unlinkSync(f);
    } catch {}
  }
}
console.log("cols", q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ingredients' ORDER BY ordinal_position`).rows);
console.log("count", q(`SELECT count(*)::int AS n FROM ingredients`).rows);
console.log("sample", q(`SELECT id, name, name_ko, slug FROM ingredients ORDER BY id ASC LIMIT 20`).rows);
console.log("search", q(`SELECT id, name, name_ko, slug FROM ingredients WHERE lower(name) LIKE '%panth%' OR lower(name) LIKE '%niacin%' OR lower(name) LIKE '%hyalur%' OR lower(name) LIKE '%ceram%' OR lower(name) LIKE '%centella%' OR lower(name) LIKE '%allanto%' ORDER BY id`).rows);

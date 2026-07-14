#!/usr/bin/env node
/** Staging-only anon REST probe for products permission (no secret prints). */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REF = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
if (REF === PROD) process.exit(2);

const root = process.cwd();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function db(sql) {
  const f = path.join(tmpdir(), `kb-probe-${process.pid}.sql`);
  writeFileSync(f, sql);
  try {
    const r = spawnSync(
      npx,
      ["supabase", "db", "query", "--linked", "--file", f],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    return (r.stdout || "").trim();
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

console.log(
  "priv=",
  db(`
SELECT has_column_privilege('anon','public.products','id','SELECT') AS anon_id,
       has_column_privilege('authenticated','public.products','id','SELECT') AS auth_id,
       has_column_privilege('anon','public.products','data_confidence','SELECT') AS anon_data_confidence,
       has_table_privilege('anon','public.products','INSERT') AS anon_insert;
`)
    .replace(/\s+/g, " ")
    .slice(0, 500)
);

const r = spawnSync(
  npx,
  [
    "supabase",
    "projects",
    "api-keys",
    "--project-ref",
    REF,
    "--reveal",
    "-o",
    "json",
  ],
  {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, npm_config_loglevel: "silent" },
  }
);
const raw = r.stdout || "";
const keys = JSON.parse(raw.slice(raw.indexOf("[")));
let anon = null;
for (const k of keys) {
  if ((k.id === "anon" || k.name === "anon") && (k.api_key || k.key)) {
    anon = String(k.api_key || k.key);
    break;
  }
}
if (!anon) {
  console.log(JSON.stringify({ phase: "fatal", reason: "no_anon" }));
  process.exit(1);
}

const base = `https://${REF}.supabase.co/rest/v1/products`;
const h = { apikey: anon, Authorization: `Bearer ${anon}` };

const okRes = await fetch(
  `${base}?select=id,name,active,verified_at&active=eq.true&verified_at=not.is.null&limit=5`,
  { headers: h }
);
const okBody = await okRes.text();
let n = -1;
try {
  n = JSON.parse(okBody).length;
} catch {
  /* ignore */
}

const badRes = await fetch(`${base}?select=id,data_confidence&limit=1`, {
  headers: h,
});
const badBody = await badRes.text();

const draftRes = await fetch(
  `${base}?select=id&active=eq.false&limit=5`,
  { headers: h }
);
const draftBody = await draftRes.text();
let draftN = -1;
try {
  draftN = JSON.parse(draftBody).length;
} catch {
  /* ignore */
}

console.log(
  JSON.stringify({
    verified_active_http: okRes.status,
    verified_active_rows: n,
    data_confidence_http: badRes.status,
    data_confidence_blocked: !badRes.ok,
    inactive_rows_visible_via_filter: draftN,
    // RLS should return 0 rows for inactive even if filter requests them
  })
);

if (!okRes.ok) {
  console.error("verified_active_failed");
  process.exit(2);
}
// data_confidence must not be readable by anon (column grant excludes it)
if (badRes.ok) {
  console.error("data_confidence_still_readable");
  process.exit(3);
}
if (draftN !== 0) {
  console.error("inactive_rows_leaked");
  process.exit(4);
}
console.log(JSON.stringify({ phase: "probe_ok", verified_active_rows: n }));


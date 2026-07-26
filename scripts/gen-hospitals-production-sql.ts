/**
 * Generate a conflict-safe INSERT .sql for migrating the Staging
 * dermatology_institution_candidates (HIRA public hospital directory,
 * non-PII) into Production. READ-ONLY on Staging; writes only a .sql file.
 * The human applies the .sql in the Production SQL Editor.
 *
 * ON CONFLICT (external_institution_id) DO NOTHING → idempotent, never
 * overwrites, safe to re-run. Only inserts into the (currently empty)
 * dermatology_institution_candidates table; touches nothing else.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const BATCH = 500;

type Row = Record<string, unknown>;

function q(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") {
    // jsonb (notes)
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

const COLS = [
  "external_institution_id",
  "name",
  "address",
  "longitude",
  "latitude",
  "phone",
  "institution_type_code",
  "institution_type_name",
  "sido_code",
  "sido_name",
  "sggu_code",
  "sggu_name",
  "department_code",
  "department_name",
  "established_date",
  "source_service",
  "source_url",
  "workflow_status",
  "notes",
  "collected_at",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT: pointed at PRODUCTION; must read from STAGING");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const all: Row[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("dermatology_institution_candidates")
      .select(COLS.join(","))
      .order("external_institution_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`select_failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as Row[]));
    if (data.length < pageSize) break;
  }

  const byStatus: Record<string, number> = {};
  for (const r of all) {
    const s = String(r.workflow_status ?? "?");
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  const outDir = path.join(process.cwd(), "data", "production-import");
  mkdirSync(outDir, { recursive: true });

  const totalParts = Math.ceil(all.length / BATCH);
  const files: { part: number; path: string; rows: number; sizeKB: number }[] = [];

  for (let i = 0, part = 1; i < all.length; i += BATCH, part += 1) {
    const chunk = all.slice(i, i + BATCH);
    const lines: string[] = [];
    lines.push(`-- Staging -> Production: dermatology_institution_candidates  (part ${part}/${totalParts})`);
    lines.push("-- HIRA public hospital directory (non-PII). Idempotent, conflict-safe.");
    lines.push("-- Inserts ONLY into dermatology_institution_candidates. Touches NO other table.");
    lines.push("-- ON CONFLICT (external_institution_id) DO NOTHING → re-runnable, never overwrites.");
    lines.push(`-- rows in this part=${chunk.length}  generatedAt=${new Date().toISOString()}`);
    lines.push("");
    lines.push("BEGIN;");
    lines.push(`INSERT INTO public.dermatology_institution_candidates (${COLS.join(", ")}) VALUES`);
    lines.push(chunk.map((r) => "  (" + COLS.map((c) => q(r[c])).join(", ") + ")").join(",\n"));
    lines.push("ON CONFLICT (external_institution_id) DO NOTHING;");
    lines.push("COMMIT;");
    lines.push("");

    const outPath = path.join(outDir, `2026-07-26-hospitals-to-production.part${part}of${totalParts}.sql`);
    const content = lines.join("\n");
    writeFileSync(outPath, content, "utf8");
    files.push({ part, path: path.relative(process.cwd(), outPath), rows: chunk.length, sizeKB: Math.round(Buffer.byteLength(content, "utf8") / 1024) });
  }

  // verify snippet as a separate tiny file
  const verifyPath = path.join(outDir, "2026-07-26-hospitals-VERIFY.sql");
  writeFileSync(verifyPath,
    "-- Run AFTER all parts. Expect ~1917 total, ~1868 verified.\n" +
    "SELECT count(*) AS total FROM public.dermatology_institution_candidates;\n" +
    "SELECT workflow_status, count(*) FROM public.dermatology_institution_candidates GROUP BY workflow_status ORDER BY workflow_status;\n",
    "utf8");

  console.log(JSON.stringify({ rows: all.length, byStatus, totalParts, files, verifyPath: path.relative(process.cwd(), verifyPath) }, null, 2));
}

main().catch((e) => { console.error("[gen-hospitals-sql] FAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; });

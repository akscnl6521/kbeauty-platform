/**
 * Production `products` · `product_offers` 스냅샷을 SQL 파일로 남긴다.
 *
 * 읽기 전용. REST 로 전량을 읽어 되돌리기용 INSERT 문으로 적는다. DB 직접 접속
 * 수단이 없어 `pg_dump` 를 쓸 수 없으므로 같은 목적을 REST 로 대신한다.
 *
 * 함께: 쓰기 권한이 있는지 **0행 매칭 UPDATE** 로 확인한다. 데이터를 바꾸지 않고
 * 권한만 본다 — 실제 반영 도중에 권한 부족을 발견하면 중간 상태가 남기 때문이다.
 *
 * 실행: npm run backup:production-catalog
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

async function fetchAll<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`${table} 조회 실패: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (Array.isArray(v)) {
    // text[] 로 복원한다. 원소 안의 따옴표·백슬래시를 이스케이프한다.
    const items = v.map((x) => `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
    return `'{${items.join(",")}}'`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function toInsertStatements(table: string, rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return `-- ${table}: 0행\n`;
  const cols = Object.keys(rows[0]);
  const lines = rows.map(
    (r) => `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => sqlLiteral(r[c])).join(", ")});`
  );
  return `-- ${table}: ${rows.length}행\n${lines.join("\n")}\n`;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.PRODUCTION_SUPABASE_ANON_KEY ??
    "";
  const usingServiceRole = Boolean(process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    console.log("Production 자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });

  const products = await fetchAll<Record<string, unknown>>(client, "products");
  const offers = await fetchAll<Record<string, unknown>>(client, "product_offers");

  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_tier1-24건-반영전.sql`;
  const header = [
    "-- Production 카탈로그 스냅샷 (되돌리기용)",
    `-- 생성: ${new Date().toISOString()}`,
    `-- 대상: products ${products.length}행 · product_offers ${offers.length}행`,
    "--",
    "-- 되돌리는 법: 대상 테이블을 지운 뒤 이 파일을 실행하면 이 시점 상태로 돌아간다.",
    "-- 지우는 조작(DELETE/TRUNCATE)은 이 파일에 넣지 않았다 — 사람이 판단할 일이다.",
    "",
  ].join("\n");
  writeFileSync(
    path,
    header + toInsertStatements("products", products) + "\n" + toInsertStatements("product_offers", offers),
    "utf8"
  );

  console.log(`백업 저장: ${path}`);
  console.log(`  products       ${products.length}행`);
  console.log(`  product_offers ${offers.length}행`);
  console.log(`  사용 자격      ${usingServiceRole ? "service_role" : "anon(publishable)"}`);

  // ── 쓰기 권한 확인: 0행에 매칭되는 UPDATE. 데이터는 바뀌지 않는다.
  const probe = await client.from("products").update({ active: false }).eq("id", -1).select("id");
  if (probe.error) {
    console.log(`\n쓰기 권한: **없음** — ${probe.error.code} ${probe.error.message}`);
    console.log("  → 반영을 시작하지 않는다. 중간 상태가 남는 것을 막기 위해 사전에 확인했다.");
    process.exitCode = 3;
    return;
  }
  console.log(`\n쓰기 권한: 있음 (0행 매칭 probe 통과, 데이터 무변경)`);
}

main().catch((e) => {
  console.error("[backup-production-catalog] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

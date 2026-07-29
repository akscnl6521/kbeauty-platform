/**
 * 되돌리기가 과해서 **원래 있던 전성분까지 지웠다.** 백업에서 복구한다.
 *
 * 무슨 일이 있었나
 *   · 반영 스크립트는 `.is("full_ingredients", null)` 가드가 있어 이미 값이 있는
 *     제품은 건드리지 않았다 (24건 중 19건만 갱신).
 *   · 그런데 되돌리기 스크립트는 그 가드를 고려하지 않고 24건 전부를 NULL 로
 *     만들었다. 그래서 **반영 전부터 있던 5건**의 전성분이 함께 사라졌다.
 *
 * 백업 파일의 INSERT 문에서 해당 제품의 원래 값을 읽어 되돌린다. 백업에 값이
 * 없던 제품은 건드리지 않는다.
 *
 * 실행: npm run restore:preexisting-ingredients -- --apply
 */
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const TOUCHED = new Set([
  1, 3, 10, 20, 27, 29, 77, 78, 80, 86, 89, 104, 105, 156, 168, 169, 171, 186, 187, 188, 189,
  190, 191, 192,
]);

/** `'{"a","b"}'` 형태의 postgres text[] 리터럴을 배열로 되돌린다. */
function parsePgArray(literal: string): string[] {
  const inner = literal.replace(/^'\{/, "").replace(/\}'$/, "");
  if (!inner.trim()) return [];
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "\\") {
      cur += inner[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out.filter(Boolean);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const file = readdirSync("backups")
    .filter((f) => f.startsWith("production_") && f.endsWith(".sql"))
    .sort()
    .pop();
  if (!file) {
    console.error("백업 파일을 찾지 못했다.");
    process.exitCode = 1;
    return;
  }
  console.log(`백업: backups/${file}`);
  const sql = readFileSync(`backups/${file}`, "utf8");

  // INSERT INTO products (col, col, ...) VALUES (...);
  const colsMatch = sql.match(/INSERT INTO products \(([^)]+)\) VALUES/);
  if (!colsMatch) {
    console.error("백업에서 products 컬럼 목록을 읽지 못했다.");
    process.exitCode = 1;
    return;
  }
  const cols = colsMatch[1].split(",").map((c) => c.trim());
  const idIdx = cols.indexOf("id");
  const fiIdx = cols.indexOf("full_ingredients");

  const restore = new Map<number, string[]>();
  for (const line of sql.split("\n")) {
    if (!line.startsWith("INSERT INTO products ")) continue;
    const values = line.slice(line.indexOf(") VALUES (") + 10, -2);
    // 값 분리 — 따옴표 안의 쉼표를 지킨다
    const parts: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < values.length; i += 1) {
      const ch = values[i];
      if (ch === "'") {
        if (q && values[i + 1] === "'") {
          cur += "''";
          i += 1;
          continue;
        }
        q = !q;
      }
      if (ch === "," && !q) {
        parts.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    parts.push(cur.trim());

    const id = Number(parts[idIdx]);
    if (!TOUCHED.has(id)) continue;
    const fi = parts[fiIdx];
    if (!fi || fi === "NULL") continue;
    const arr = parsePgArray(fi);
    if (arr.length > 0) restore.set(id, arr);
  }

  console.log(`백업에 전성분이 있던 제품: ${restore.size}건`);
  for (const [id, arr] of restore)
    console.log(`  ${String(id).padStart(4)} ${arr.length}개 | ${arr.slice(0, 3).join(", ").slice(0, 60)}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 복구한다.");
    return;
  }
  if (restore.size === 0) {
    console.log("복구할 것이 없다 — 되돌리기로 잃은 값이 없다.");
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  let restored = 0;
  for (const [id, arr] of restore) {
    const { data, error } = await client
      .from("products")
      .update({ full_ingredients: arr })
      .eq("id", id)
      .select("id");
    if (error) {
      console.log(`  ${id} 실패: ${error.code} ${error.message}`);
      continue;
    }
    if ((data ?? []).length > 0) restored += 1;
  }
  console.log(`\n복구 ${restored}건`);
}

main().catch((e) => {
  console.error("[restore-preexisting-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

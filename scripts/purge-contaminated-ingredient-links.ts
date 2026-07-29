/**
 * 2026-07-29 반영에서 들어간 **오염된 성분 링크 131건을 지운다.** 승인 받은 작업.
 *
 * 왜 지우나 — 링크의 근거가 된 전성분 토큰이 페이지 네비게이션·마케팅 문구였다
 * (DASHBOARD §32). 근거가 틀린 링크를 남겨 두면 나중에 사전이 채워졌을 때 잘못된
 * 성분으로 추천이 나간다.
 *
 * 대상 특정 — 기존 데이터와 완전히 분리된다:
 *   내가 넣은 것   `source_type = 'official_brand_page'`, 2026-07-29 생성, 131행
 *   원래 있던 것   `source_type = 'admin_entry'`,        2026-07-16 생성, 111행
 *
 * **`admin_entry` 는 건드리지 않는다.** 지우기 전에 지울 행 전체를 파일로 남긴다.
 *
 * 실행: npm run purge:contaminated-links -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
/** 이 조합에 해당하는 것만 지운다. 조건을 넓히지 않는다. */
const TARGET_SOURCE_TYPE = "official_brand_page";
const TARGET_DATE_PREFIX = "2026-07-29";

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${String(v).replace(/'/g, "''")}'`;
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

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await client
    .from("product_ingredients")
    .select("*")
    .eq("source_type", TARGET_SOURCE_TYPE);
  if (error) throw new Error(`조회 실패: ${error.code} ${error.message}`);

  const targets = (rows ?? []).filter((r) =>
    String((r as { created_at?: string }).created_at ?? "").startsWith(TARGET_DATE_PREFIX)
  );

  const { count: totalBefore } = await client
    .from("product_ingredients")
    .select("*", { count: "exact", head: true });

  console.log(`product_ingredients 총 ${totalBefore}행`);
  console.log(`삭제 대상 ${targets.length}행 (${TARGET_SOURCE_TYPE} · ${TARGET_DATE_PREFIX})`);
  console.log(`보존 대상 ${(totalBefore ?? 0) - targets.length}행`);

  if (targets.length === 0) {
    console.log("지울 것이 없다.");
    return;
  }

  // 지우기 전에 전량을 복원 가능한 형태로 남긴다.
  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_product-ingredients-오염링크-삭제전.sql`;
  const cols = Object.keys(targets[0] as Record<string, unknown>);
  const lines = targets.map(
    (r) =>
      `INSERT INTO product_ingredients (${cols.join(", ")}) VALUES (${cols
        .map((c) => sqlLiteral((r as Record<string, unknown>)[c]))
        .join(", ")});`
  );
  writeFileSync(
    path,
    [
      "-- 오염된 성분 링크 삭제 전 스냅샷 (되돌리기용)",
      `-- 생성: ${new Date().toISOString()}`,
      `-- 대상: source_type=${TARGET_SOURCE_TYPE} · created_at ${TARGET_DATE_PREFIX} · ${targets.length}행`,
      "",
      ...lines,
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 삭제한다.");
    return;
  }

  // id 로 하나씩 지운다 — 조건식 실수로 범위가 넓어지는 것을 막는다.
  let deleted = 0;
  for (const r of targets) {
    const id = (r as { id: string | number }).id;
    const { data, error: delErr } = await client
      .from("product_ingredients")
      .delete()
      .eq("id", id)
      .select("id");
    if (delErr) {
      console.log(`  ${id} 실패: ${delErr.code} ${delErr.message}`);
      continue;
    }
    if ((data ?? []).length > 0) deleted += 1;
  }

  const { count: totalAfter } = await client
    .from("product_ingredients")
    .select("*", { count: "exact", head: true });
  console.log(`\n삭제 ${deleted}행 · 남은 행 ${totalAfter}`);

  const { count: adminLeft } = await client
    .from("product_ingredients")
    .select("*", { count: "exact", head: true })
    .eq("source_type", "admin_entry");
  console.log(`admin_entry 보존 확인: ${adminLeft}행`);
}

main().catch((e) => {
  console.error("[purge-contaminated-ingredient-links] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

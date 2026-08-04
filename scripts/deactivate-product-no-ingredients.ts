/**
 * 전성분에 **실제 성분이 하나도 없는** 활성 제품을 내린다. 승인 받은 작업이다(2026-07-30).
 *
 * 대상은 §37 감사에서 (나) 유형으로 분류된 것 — 목록 자리에 성분이 아닌 값만 있어
 * 알레르겐 검사가 훑을 성분이 없는 제품이다. 그 상태로는 어떤 알레르기를 입력해도
 * «알레르겐 없음 = 안전» 으로 나온다.
 *
 * ## 왜 전성분을 비우는 게 아니라 제품을 내리는가
 *
 * `full_ingredients` 를 NULL 로 만들면 안전 필터가 `key_ingredients` 만 보게 되는데,
 * 그건 기능성 성분 사전으로 고른 부분집합이라 향료·리모넨·리날룰이 구조적으로 빠진다
 * (§34 에서 고친 결함). 비우면 «알레르겐 없음» 판정이 그대로 유지되므로 해법이 아니다.
 *
 * 오염된 값도 **그대로 남긴다.** 지우면 무엇이 잘못됐는지 추적할 근거가 사라진다.
 * 제품이 비활성이면 추천 풀에 들어가지 않으므로 노출은 멈춘다.
 *
 * 안전장치
 *   · `--apply` 없이는 아무것도 쓰지 않는다.
 *   · 쓰기 전 현재 행을 `backups/` 에 복원용 SQL 로 남긴다.
 *   · 대상 id 는 코드에 박아 둔다 — 조건으로 넓게 잡아 엉뚱한 행을 내리지 않는다.
 *
 * 실행: npx tsx scripts/deactivate-product-no-ingredients.ts --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/** 대상과 근거. 감사 결과(§37)에서 (나) 유형으로 확인된 것만. */
const TARGETS: ReadonlyArray<{ id: number; expectName: string; why: string }> = [
  {
    id: 1,
    expectName: "Centella Water Alcohol-Free Toner",
    why: "full_ingredients 전체가 자바스크립트 배열(\"works\"·\"skin\"·\"bottle\"…) — 실제 성분 0개. 알레르겐 검사 불가",
  },
];

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const ids = TARGETS.map((t) => t.id);
  const { data, error } = await client
    .from("products")
    .select("id,name,brand,active,verified_at")
    .in("id", ids);
  if (error) throw new Error(`products: ${error.code} ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number;
    name: string | null;
    brand: string | null;
    active: boolean | null;
    verified_at: string | null;
  }>;

  console.log("대상:");
  for (const t of TARGETS) {
    const row = rows.find((r) => r.id === t.id);
    if (!row) {
      console.log(`  ${t.id} — 행이 없다. 건너뛴다.`);
      continue;
    }
    // 이름이 다르면 id 가 다른 제품을 가리키는 것이므로 손대지 않는다.
    if (!String(row.name ?? "").includes(t.expectName)) {
      console.log(`  ${t.id} — 이름 불일치 («${row.name}»). 안전을 위해 건너뛴다.`);
      continue;
    }
    console.log(`  ${t.id} ${row.brand} ${row.name} · active=${row.active}`);
    console.log(`      근거: ${t.why}`);
  }

  if (!apply) {
    console.log("\ndry-run. --apply 를 붙이면 active=false 로 내린다.");
    return;
  }

  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_제품-비활성화전.sql`;
  writeFileSync(
    path,
    [
      "-- 비활성화 전 상태 (되돌리려면 아래를 실행)",
      `-- 생성: ${new Date().toISOString()}`,
      "",
      ...rows.map((r) => `UPDATE products SET active = ${r.active ? "TRUE" : "FALSE"} WHERE id = ${r.id};`),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  let done = 0;
  for (const t of TARGETS) {
    const row = rows.find((r) => r.id === t.id);
    if (!row || !String(row.name ?? "").includes(t.expectName)) continue;
    const { data: up, error: e } = await client
      .from("products")
      .update({ active: false })
      .eq("id", t.id)
      .select("id,active");
    if (e) {
      console.log(`  ${t.id} 실패: ${e.code} ${e.message}`);
      continue;
    }
    if ((up ?? []).length > 0) {
      done += 1;
      console.log(`  ${t.id} active=false`);
    }
  }
  console.log(`\n비활성화 ${done}행`);
}

main().catch((e) => {
  console.error("[deactivate-product-no-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

/**
 * Production 테이블 **행 수만** 읽는다. 읽기 전용.
 *
 * 왜 별도 스크립트인가 — 이 저장소의 다른 스크립트는 전부 Production ref 를
 * 만나면 `ABORT_PRODUCTION` 으로 즉시 멈춘다. 그 가드는 그대로 두고, 사람이
 * 명시적으로 지시한 «행 수 확인» 만 하는 경로를 따로 뒀다.
 *
 * 하는 것 / 안 하는 것
 *   · `count` 만 요청한다 (`head: true`) — 행 내용을 가져오지 않는다.
 *   · INSERT / UPDATE / DELETE 없음.
 *   · URL·키 값을 출력하지 않는다. ref 는 마스킹해서 보여준다.
 *
 * 자격증명은 **Staging 용과 다른 이름**을 쓴다. 실수로 Staging 을 Production
 * 이라고 보고하는 일이 없도록, 아래 두 변수가 있을 때만 동작한다:
 *
 *   PRODUCTION_SUPABASE_URL
 *   PRODUCTION_SUPABASE_SERVICE_ROLE_KEY
 *
 * 실행: npm run check:production-table-counts
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/** ref 는 문서·로그·채팅에 원문으로 남기지 않는다. */
function mask(ref: string): string {
  if (ref.length <= 7) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

const TABLES = [
  "dermatology_institution_candidates",
  "products",
  "product_offers",
  "product_ingredients",
  "ingredients",
] as const;

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !key) {
    console.log("Production 자격증명이 이 세션에 없다. 조회하지 않고 멈춘다.\n");
    console.log("  PRODUCTION_SUPABASE_URL                 " + (url ? "있음" : "없음"));
    console.log("  PRODUCTION_SUPABASE_SERVICE_ROLE_KEY    " + (key ? "있음" : "없음"));
    process.exitCode = 2;
    return;
  }

  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) {
    // 다른 프로젝트를 Production 이라고 보고하는 사고를 막는다.
    console.error(
      `ABORT: PRODUCTION_SUPABASE_URL 의 ref(${mask(ref)})가 기대값과 다르다. 조회하지 않는다.`
    );
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  console.log(`Production(${mask(ref)}) 행 수 — 읽기 전용, count 만 요청\n`);

  for (const table of TABLES) {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ${table.padEnd(38)} 조회 실패: ${error.code} ${error.message}`);
      continue;
    }
    console.log(`  ${table.padEnd(38)} ${count ?? "(null)"}`);
  }

  // products 는 조건별로도 본다 — 191 vs 2 불일치 진단용.
  const conditions: Array<{ label: string; apply: (q: never) => never }> = [
    { label: "active = true", apply: ((q: never) => (q as never as { eq: (a: string, b: unknown) => never }).eq("active", true)) as never },
    { label: "verified_at 있음", apply: ((q: never) => (q as never as { not: (a: string, b: string, c: unknown) => never }).not("verified_at", "is", null)) as never },
  ];
  console.log("");
  for (const c of conditions) {
    let q = client.from("products").select("*", { count: "exact", head: true });
    q = c.apply(q as never) as never;
    const { count, error } = await q;
    console.log(
      `  products ${c.label.padEnd(28)} ${error ? `조회 실패: ${error.message}` : (count ?? "(null)")}`
    );
  }
}

main().catch((e) => {
  console.error("[count-production-tables-readonly] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

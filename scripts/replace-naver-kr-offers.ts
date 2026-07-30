/**
 * 네이버로 넣은 국내 오퍼를 **새 수집분으로 교체**한다.
 *
 * 왜 교체인가 — 초기 수집은 유사도 최고를 골라 시세보다 비싼 매물이 들어갔다
 * (스네일 96 에센스 53,950원 → 올리브영 23,000원). 질의·필터를 고친 뒤 다시 뽑았는데,
 * 옛 오퍼를 그대로 두면 부풀린 가격이 함께 남아 사용자가 잘못된 값을 본다.
 *
 * `source = 'naver_shopping'` 인 것만 지운다 — 브랜드 공식몰 오퍼(`brand_official_site`)와
 * 원래 있던 오퍼는 건드리지 않는다. 지우기 전에 파일로 남긴다.
 *
 * 실행: npm run replace:naver-offers -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const SOURCE = "naver_shopping";

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
  const { data: rows, error } = await client.from("product_offers").select("*").eq("source", SOURCE);
  if (error) throw new Error(error.message);
  const targets = rows ?? [];

  console.log(`${SOURCE} 오퍼 ${targets.length}행`);
  for (const r of targets as Array<Record<string, unknown>>)
    console.log(
      `  제품 ${String(r.product_id).padStart(4)} ${String(r.retailer_name).padEnd(10)}${String(r.price).padStart(8)}원`
    );

  if (!apply) {
    console.log("\ndry-run. --apply 로 지운다. 그 다음 collect:kr-offers -- --apply 를 다시 돌린다.");
    return;
  }
  if (targets.length === 0) return;

  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_naver-offers-교체전.sql`;
  const cols = Object.keys(targets[0] as Record<string, unknown>);
  const lit = (v: unknown) =>
    v === null || v === undefined
      ? "NULL"
      : typeof v === "number"
        ? String(v)
        : typeof v === "boolean"
          ? v ? "TRUE" : "FALSE"
          : Array.isArray(v)
            ? `'{${v.map((x) => `"${String(x)}"`).join(",")}}'`
            : `'${String(v).replace(/'/g, "''")}'`;
  writeFileSync(
    path,
    [
      `-- ${SOURCE} 오퍼 교체 전 스냅샷 · ${targets.length}행`,
      `-- 생성: ${new Date().toISOString()}`,
      "",
      ...(targets as Array<Record<string, unknown>>).map(
        (r) =>
          `INSERT INTO product_offers (${cols.join(", ")}) VALUES (${cols.map((c) => lit(r[c])).join(", ")});`
      ),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  let deleted = 0;
  for (const r of targets as Array<{ id: string | number }>) {
    const { data, error: e } = await client.from("product_offers").delete().eq("id", r.id).select("id");
    if (e) {
      console.log(`  ${r.id} 실패: ${e.message}`);
      continue;
    }
    if ((data ?? []).length > 0) deleted += 1;
  }
  const { count } = await client.from("product_offers").select("*", { count: "exact", head: true });
  console.log(`\n삭제 ${deleted}행 · 오퍼 총 ${count}행`);
  console.log("이제 npm run collect:kr-offers -- --apply 로 새 수집분을 넣는다.");
}

main().catch((e) => {
  console.error("[replace-naver-kr-offers] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

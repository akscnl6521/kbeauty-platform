/**
 * Production `products.full_ingredients` 에 **오염된 값이 남아 있는지** 감사한다.
 *
 * 왜 급한가 — `full_ingredients` 는 알레르겐 필터가 읽는 입력이다(2026-07-27 에
 * 필터가 주요 성분만 보던 것을 전성분 전체로 확장했다). 여기에 페이지 문구가
 * 섞여 있으면 성분 대조가 어긋나고, 결과는 "안전하다" 는 **잘못된 판정**이다.
 *
 * 2026-07-29 에 오염 18건을 Production 에 저장했다가 되돌렸는데, 되돌린 범위가
 * 정확했는지 실제로 읽어서 확인한 적이 없다. 이번에 검증기가 생겼으니 전수로 본다.
 *
 * **읽기 전용.** 아무것도 쓰지 않는다.
 *
 * 실행: npm run check:production-full-ingredients
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { validateIngredientList } from "../src/lib/catalog/validateIngredientList";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

type Row = {
  id: number;
  name: string | null;
  brand: string | null;
  active: boolean | null;
  verified_at: string | null;
  full_ingredients: string[] | string | null;
};

/** PostgREST 는 1000행에서 자른다. limit 을 키워도 안 되고 페이지로 넘겨야 한다. */
async function fetchAll(client: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id,name,brand,active,verified_at,full_ingredients")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`products: ${error.code} ${error.message}`);
    const page = (data ?? []) as Row[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function asText(v: Row["full_ingredients"]): string {
  if (Array.isArray(v)) return v.join(", ");
  return String(v ?? "");
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PRODUCTION_SUPABASE_ANON_KEY ?? "";
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
  const rows = await fetchAll(client);
  const withIngredients = rows.filter((r) => asText(r.full_ingredients).trim().length > 0);

  console.log(`products ${rows.length}행 · 전성분 있음 ${withIngredients.length}행\n`);

  const bad: Array<{ row: Row; reason: string; sample?: string }> = [];
  for (const r of withIngredients) {
    const v = validateIngredientList(asText(r.full_ingredients));
    if (!v.ok) bad.push({ row: r, reason: v.reason, sample: v.sample });
  }

  const badActive = bad.filter((b) => b.row.active === true);
  console.log(`검증 반려 ${bad.length}행 (그중 활성 ${badActive.length}행)\n`);

  if (badActive.length > 0) {
    console.log("!! 사용자에게 노출 중인 제품의 전성분이 오염됐다 — 즉시 조치 필요:");
    for (const b of badActive)
      console.log(
        `  ${String(b.row.id).padStart(4)} ${String(b.row.brand).padEnd(16)} ${String(b.row.name).slice(0, 34).padEnd(36)} ${b.reason}${b.sample ? ` (${b.sample.slice(0, 40)})` : ""}`
      );
    console.log("");
  }

  const badInactive = bad.filter((b) => b.row.active !== true);
  if (badInactive.length > 0) {
    console.log(`비활성 제품 반려 ${badInactive.length}행 (노출 안 됨 — 활성화 전 정리 대상):`);
    for (const b of badInactive.slice(0, 30))
      console.log(
        `  ${String(b.row.id).padStart(4)} ${String(b.row.brand).padEnd(16)} ${b.reason}${b.sample ? ` (${b.sample.slice(0, 40)})` : ""}`
      );
    if (badInactive.length > 30) console.log(`  … 외 ${badInactive.length - 30}행`);
  }

  const okActive = withIngredients.filter(
    (r) => r.active === true && validateIngredientList(asText(r.full_ingredients)).ok
  ).length;
  console.log(`\n활성 제품 중 전성분 검증 통과 ${okActive}행`);

  mkdirSync("artifacts/production-audit", { recursive: true });
  const path = "artifacts/production-audit/full-ingredients-verdicts.json";
  writeFileSync(
    path,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        totalProducts: rows.length,
        withIngredients: withIngredients.length,
        rejected: bad.map((b) => ({
          id: b.row.id,
          brand: b.row.brand,
          name: b.row.name,
          active: b.row.active,
          reason: b.reason,
          sample: b.sample,
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`결과 저장: ${path}`);

  if (badActive.length > 0) process.exitCode = 3;
}

main().catch((e) => {
  console.error("[audit-production-full-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

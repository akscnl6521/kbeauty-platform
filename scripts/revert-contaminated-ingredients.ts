/**
 * 2026-07-29 반영에서 **오염된 전성분을 되돌린다.**
 *
 * 무슨 일이 있었나 — Tier 1 반영에서 제품 페이지 HTML 로부터 전성분을 뽑았는데,
 * `extractLabeledIngredientsRaw` 가 「전성분」 라벨 대신 페이지 네비게이션·마케팅
 * 문구를 잡은 경우가 많았다. 24건 중 18건에서 다음 같은 값이 들어갔다:
 *
 *   "Body From Skin to Hair Care Body Care Hair"      ← 네비게이션
 *   "avoid storing in high temperatures"               ← 보관 주의
 *   "$24 Value Lip Sleeping Mask Nourish"              ← 판촉 문구
 *   "BENEFITS &bull"                                   ← 섹션 제목
 *
 * 성분을 지어낸 것과 같은 결과다. 사용자에게 노출되기 전에 지운다.
 * (다행히 활성화는 0건이라 실제 노출은 없었다.)
 *
 * 되돌리는 범위는 **이번에 건드린 24건뿐**이다. 다른 제품은 손대지 않는다.
 * `full_ingredients` 를 NULL 로 되돌리는 UPDATE 만 한다 — 행을 지우지 않는다.
 *
 * 실행: npm run revert:contaminated-ingredients -- --apply
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/** 2026-07-29 Tier 1 반영에서 full_ingredients 를 건드린 제품 */
const TOUCHED = [
  1, 3, 10, 20, 27, 29, 77, 78, 80, 86, 89, 104, 105, 156, 168, 169, 171, 186, 187, 188, 189,
  190, 191, 192,
];

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

  const { data: before } = await client
    .from("products")
    .select("id,name,full_ingredients")
    .in("id", TOUCHED);
  const filled = (before ?? []).filter(
    (p) => Array.isArray(p.full_ingredients) && p.full_ingredients.length > 0
  );
  console.log(`대상 ${TOUCHED.length}건 · 전성분이 채워져 있는 것 ${filled.length}건`);

  if (!apply) {
    for (const p of filled) {
      const f = p.full_ingredients as string[];
      console.log(`  ${String(p.id).padStart(4)} ${String(p.name).slice(0, 34).padEnd(36)} ${f.length}개 | ${String(f[0]).slice(0, 50)}`);
    }
    console.log("\ndry-run. --apply 로 되돌린다.");
    return;
  }

  let reverted = 0;
  for (const p of filled) {
    const { data, error } = await client
      .from("products")
      .update({ full_ingredients: null })
      .eq("id", p.id)
      .select("id");
    if (error) {
      console.log(`  ${p.id} 실패: ${error.code} ${error.message}`);
      continue;
    }
    if ((data ?? []).length > 0) reverted += 1;
  }
  console.log(`\n되돌림 ${reverted}건`);

  const { count } = await client
    .from("products")
    .select("*", { count: "exact", head: true })
    .not("full_ingredients", "is", null);
  console.log(`전성분이 남아 있는 제품 총 ${count}건`);
}

main().catch((e) => {
  console.error("[revert-contaminated-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

/**
 * **다른 제품의 전성분을 들고 있거나, 같은 제품이 두 번 등록된 것**을 추천 풀에서 내린다.
 *
 * `check:duplicate-formulas` 가 찾아낸 것 중 **출처를 눈으로 확인한 건만** 여기 적는다.
 * 자동 판정하지 않는다 — 어느 쪽이 맞는지는 `product_ingredients.source_url` 을
 * 봐야 알 수 있고, 자동화하면 멀쩡한 제품을 내리게 된다.
 *
 * ## 왜 지우지 않고 내리기만 하나
 *
 * 제품 행을 지우면 그 제품에 달린 오퍼·성분 링크·이미지가 같이 끊긴다. 되돌리기도
 * 어렵다. `active=false` 면 추천 풀에서만 빠지고 데이터는 남는다 — 나중에 올바른
 * 전성분을 다시 받아 오면 그대로 되살릴 수 있다.
 *
 * 실행: npm run apply:deactivate-wrong-data            # dry-run
 *       npm run apply:deactivate-wrong-data -- --apply
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 2026-08-08 `check:duplicate-formulas` 실측 + 출처 확인.
 *
 * 241/253(달바 150ml/160ml)은 **여기 넣지 않는다.** 출처 페이지가 서로 다르고
 * 용량만 다른 실제 상품 둘이다. 둘 다 카탈로그에 있는 게 맞다.
 */
const TARGETS: ReadonlyArray<{ id: number; why: string; evidence: string }> = [
  {
    id: 77,
    why: "다른 제품의 전성분을 들고 있다 — 알레르기·회피 판정이 엉뚱한 제형을 본다",
    evidence:
      "«Black Snail All In One Cream» 인데 성분 출처가 " +
      "cosrx.com/products/advanced-snail-92-all-in-one-cream (Advanced Snail 92 페이지)",
  },
  {
    id: 21,
    why: "187 과 같은 제품이 두 번 등록됐다",
    evidence:
      "21 과 187 의 성분 출처가 둘 다 cosrx.com/products/cosrx-advanced-the-vitamin-c-23-serum · " +
      "전성분 30개가 글자까지 같다 · 21 의 slug 는 skin1004-vitamin-c-serum 으로 브랜드와도 어긋난다",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }
  console.log(`대상 DB: Production (${ref})\n`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  for (const t of TARGETS) {
    const { data, error } = await client
      .from("products")
      .select("id,brand,name,active,verified_at")
      .eq("id", t.id)
      .maybeSingle();
    if (error) {
      console.log(`  ${t.id} 조회 실패: ${error.code} ${error.message.slice(0, 70)}`);
      continue;
    }
    if (!data) {
      console.log(`  ${t.id} 없음 — 건너뛴다`);
      continue;
    }
    console.log(`  ${t.id} ${data.brand} «${data.name}» (지금 active=${data.active})`);
    console.log(`      내리는 이유: ${t.why}`);
    console.log(`      근거: ${t.evidence}`);
  }

  if (!apply) {
    console.log("\ndry-run. --apply 로 내린다.");
    return;
  }

  let done = 0;
  for (const t of TARGETS) {
    // `active=true` 인 것만 바꾼다 — 이미 내려간 것을 다시 건드리지 않는다.
    const { data, error } = await client
      .from("products")
      .update({ active: false })
      .eq("id", t.id)
      .eq("active", true)
      .select("id");
    if (error) {
      console.log(`  ${t.id} 실패: ${error.code} ${error.message.slice(0, 70)}`);
      continue;
    }
    if ((data ?? []).length > 0) done += 1;
    else console.log(`  ${t.id} 이미 내려가 있다`);
  }
  console.log(`\n추천 풀에서 내린 제품 ${done}건`);
}

main().catch((e) => {
  console.error("[deactivate-wrong-data-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

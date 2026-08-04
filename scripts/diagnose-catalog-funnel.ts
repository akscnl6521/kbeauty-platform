/**
 * **왜 추천에 나오는 제품이 17개뿐인가** — 191건이 어디서 걸러지는지 단계별로 센다.
 *
 * 읽기 전용. 사용자가 «선택할 폭이 좁다» 고 느끼는 것의 근거를 숫자로 만든다.
 * 추측으로 «데이터가 부족하다» 고 말하지 않는다 — 어느 관문에서 몇 건이 떨어지는지 본다.
 *
 * 실행: npm run check:catalog-funnel
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

type Row = Record<string, unknown>;

async function fetchAll(client: SupabaseClient, table: string, select: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as Row[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PRODUCTION_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) {
    console.log("Production 자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: Production ref 가 아니다.");
    process.exitCode = 1;
    return;
  }

  const { normalizeProductOffer, isOfferPurchasableForCta } = await import("@/lib/recommend");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const products = await fetchAll(
    client,
    "products",
    "id,brand,name,category,active,verified_at,key_ingredients,full_ingredients"
  );
  const offers = await fetchAll(
    client,
    "product_offers",
    "id,product_id,retailer_name,retailer_country,ships_to_countries,purchase_url,price,currency," +
      "stock_status,verification_status,is_official,verified_at,last_checked_at,rating,review_count,source,active"
  );

  const offersByProduct = new Map<string, Row[]>();
  for (const o of offers) {
    const pid = String(o.product_id);
    offersByProduct.set(pid, [...(offersByProduct.get(pid) ?? []), o]);
  }

  const hasKr = (pid: string) =>
    (offersByProduct.get(pid) ?? []).some((o) => {
      const n = normalizeProductOffer(o);
      return n != null && isOfferPurchasableForCta(n, "KR");
    });

  const total = products.length;
  const active = products.filter((p) => p.active === true);
  const verified = active.filter((p) => p.verified_at != null);
  const withKey = products.filter((p) => arr(p.key_ingredients).length > 0);
  const withFull = products.filter((p) => arr(p.full_ingredients).length > 0);
  const withAnyOffer = products.filter((p) => (offersByProduct.get(String(p.id)) ?? []).length > 0);
  const withKrOffer = products.filter((p) => hasKr(String(p.id)));

  console.log("═══ 카탈로그 깔때기 (Production) ═══\n");
  const line = (label: string, n: number) =>
    console.log(`  ${label.padEnd(38)}${String(n).padStart(5)}  ${"█".repeat(Math.round((n / total) * 40))}`);
  line("products 전체", total);
  line("active = true", active.length);
  line("+ verified_at 있음 (= 추천 풀)", verified.length);
  console.log("");
  line("주요성분(key_ingredients) 있음", withKey.length);
  line("전성분(full_ingredients) 있음", withFull.length);
  line("오퍼가 하나라도 있음", withAnyOffer.length);
  line("국내 구매 가능 오퍼 있음", withKrOffer.length);

  // 활성화를 막는 것이 무엇인지 — 비활성 제품에서 무엇이 빠졌나
  const notInPool = products.filter((p) => !(p.active === true && p.verified_at != null));
  const missKey = notInPool.filter((p) => arr(p.key_ingredients).length === 0).length;
  const missFull = notInPool.filter((p) => arr(p.full_ingredients).length === 0).length;
  const missOffer = notInPool.filter((p) => (offersByProduct.get(String(p.id)) ?? []).length === 0).length;
  const missKr = notInPool.filter((p) => !hasKr(String(p.id))).length;

  console.log(`\n═══ 추천 풀 밖 ${notInPool.length}건 — 무엇이 없나 (중복 집계) ═══\n`);
  console.log(`  주요성분 없음        ${String(missKey).padStart(4)}건`);
  console.log(`  전성분 없음          ${String(missFull).padStart(4)}건`);
  console.log(`  오퍼 자체가 없음     ${String(missOffer).padStart(4)}건`);
  console.log(`  국내 구매 오퍼 없음  ${String(missKr).padStart(4)}건`);

  // «성분은 있는데 풀 밖» — 오퍼만 붙이면 살아날 수 있는 것
  const ingredientsReady = notInPool.filter(
    (p) => arr(p.key_ingredients).length > 0 && arr(p.full_ingredients).length > 0
  );
  console.log(`\n  ▶ 성분은 갖췄는데 풀 밖: ${ingredientsReady.length}건 (오퍼·검증만 붙으면 후보)`);
  for (const p of ingredientsReady.slice(0, 15))
    console.log(
      `      ${String(p.id).padStart(4)} ${String(p.brand).padEnd(18)} ${String(p.name).slice(0, 34).padEnd(36)}` +
        `오퍼 ${(offersByProduct.get(String(p.id)) ?? []).length}건`
    );

  // 브랜드 다양성 — 사용자가 «회사 종류가 적다» 고 느끼는 부분
  const poolBrands = new Map<string, number>();
  for (const p of verified) poolBrands.set(String(p.brand ?? "-"), (poolBrands.get(String(p.brand ?? "-")) ?? 0) + 1);
  const allBrands = new Set(products.map((p) => String(p.brand ?? "-")));
  console.log(`\n═══ 브랜드 ═══\n`);
  console.log(`  DB 전체 브랜드 ${allBrands.size}개 · 추천 풀 브랜드 ${poolBrands.size}개`);
  console.log(`  풀 구성: ${[...poolBrands.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} ${n}`).join(" · ")}`);

  // 이미지 — 스키마에 컬럼이 있는지부터
  const sample = products[0] ?? {};
  const imageCols = Object.keys(sample).filter((k) => /image|img|photo|thumb/i.test(k));
  console.log(`\n═══ 이미지 ═══\n`);
  console.log(
    imageCols.length === 0
      ? "  products 테이블에 이미지 컬럼이 **하나도 없다.** 화면의 이미지 자리는 구조적으로 빈다."
      : `  이미지 컬럼: ${imageCols.join(", ")}`
  );
}

main().catch((e) => {
  console.error("[diagnose-catalog-funnel] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

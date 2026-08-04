/**
 * 식약처 «화장품 규제정보» 로 제품 단위 금지 판정이 **가능한지** 조사한다. 읽기 전용.
 *
 * ## 결론부터 — 이 데이터로는 제품 단위 판정을 할 수 없다 (2026-08-04 실측)
 *
 * 처음 의도는 «추천에 나오는 제품에 한국에서 금지된 성분이 있는지» 를 공식 출처로
 * 확인하는 것이었다. 실제로 돌려 보니 **성분명 대조로는 판정이 안 된다.**
 *
 * ### 근거 1 — 금지 조건이 성분명 안에 박혀 있다
 *
 * ```
 * INGR_STD_NAME  과산화물가가 10mmol/L을 초과하는 대왕소나무 잎과 잔가지의 오일 및 추출물
 * PROH_NATIONAL  한국
 * ```
 *
 * 금지 대상은 «대왕소나무 추출물» 이 아니라 **규격을 벗어난 형태**다. 이름만 맞춰
 * 보면 정상 제품에 «금지 성분» 딱지가 붙는다.
 *
 * ### 근거 2 — 비율이 말이 안 된다
 *
 * 7,257행 중 **3,385행(47%)** 이 `PROH_NATIONAL` 에 한국을 단다. 단순 금지 원료
 * 목록이라면 나올 수 없는 비율이다. 국제 규제 비교표에 가깝다.
 *
 * ### 근거 3 — 결과가 현실과 어긋난다
 *
 * `Tromethamine`(pH 조절제)이 «한국 금지» 로 잡혔는데, 라네즈·설화수·이니스프리·
 * 라운드랩·조선미녀·코스알엑스 제품에 들어 있다. 정말 금지라면 이 제품들이 존재할 수 없다.
 *
 * ## 그래서 이 스크립트는 «감사» 가 아니라 «조사 기록» 이다
 *
 * 적중 목록을 **경보로 쓰지 않는다.** 나중에 조건까지 담은 데이터셋이 생기거나
 * 필드 의미가 확인되면 그때 판정 도구로 바꿀 수 있도록 기계 부분만 남긴다.
 *
 * 함께 확인한 것: 규제는 **성분의 신원**을 따지는 것이라 별칭 병합된 캐논컬
 * (`toCanonical`)을 쓰면 안 된다. 그건 회피 판정용이라 `Betaine Salicylate` ·
 * `BHA` · `Salicylic Acid` 를 한 키로 묶어, 규제 목록의 «베타인살리실레이트» 항목이
 * 평범한 `Salicylic Acid` 제품을 전부 적중시켰다. `normalizeIngredient` 를 쓴다.
 *
 * **읽기 전용.** DB 에 쓰지 않는다.
 *
 * 실행: npm run check:prohibited-ingredients
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const ENDPOINT =
  "https://apis.data.go.kr/1471000/CsmtcsReglMaterialInfoService/getCsmtcsReglMaterialInfoService";
const PAGE_SIZE = 100;
/** 국가 표기 — API 는 쉼표로 이어 붙인 국가명을 준다. */
const KOREA = "한국";

type ReglRow = {
  INGR_STD_NAME?: string;
  INGR_ENG_NAME?: string;
  PROH_NATIONAL?: string;
  LIMIT_NATIONAL?: string;
};

type Product = {
  id: number;
  name: string | null;
  brand: string | null;
  active: boolean | null;
  verified_at: string | null;
  full_ingredients: string[] | string | null;
};

function isInRecommendationPool(p: Product): boolean {
  return p.active === true && p.verified_at != null;
}

async function fetchAllProducts(client: SupabaseClient): Promise<Product[]> {
  const out: Product[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id,name,brand,active,verified_at,full_ingredients")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`products: ${error.code} ${error.message}`);
    const page = (data ?? []) as Product[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/** 규제 목록 전량. 페이지로 끝까지 받는다. */
async function fetchRegulatedIngredients(serviceKey: string): Promise<ReglRow[]> {
  const out: ReglRow[] = [];
  for (let page = 1; page <= 200; page += 1) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", String(page));
    url.searchParams.set("numOfRows", String(PAGE_SIZE));
    url.searchParams.set("_type", "json");

    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`규제정보 API HTTP ${r.status}`);
    const text = await r.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      // 인증 오류는 XML 로 온다. 값은 절대 출력하지 않는다.
      throw new Error("규제정보 API 가 JSON 이 아닌 응답을 돌려줬다 (인증키 문제일 수 있다)");
    }
    const items =
      (body as { body?: { items?: ReglRow[] | { item?: ReglRow | ReglRow[] } } })?.body?.items ??
      (body as { response?: { body?: { items?: ReglRow[] | { item?: ReglRow | ReglRow[] } } } })
        ?.response?.body?.items;
    const rows: ReglRow[] = Array.isArray(items)
      ? items
      : items && typeof items === "object" && "item" in items
        ? Array.isArray(items.item)
          ? items.item
          : items.item
            ? [items.item]
            : []
        : [];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    await new Promise((res) => setTimeout(res, 250));
  }
  return out;
}

function listsKorea(field: string | undefined): boolean {
  return String(field ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(KOREA);
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PRODUCTION_SUPABASE_ANON_KEY ?? "";
  const serviceKey = (
    process.env.MFDS_DATA_GO_KR_SERVICE_KEY ??
    process.env.DATA_GO_KR_SERVICE_KEY ??
    ""
  ).trim();

  if (!url || !key) {
    console.log("Supabase 자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if (!serviceKey) {
    console.log("식약처 인증키 없음 (MFDS_DATA_GO_KR_SERVICE_KEY) — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  // 별칭 병합 없는 정규화를 쓴다 — 위 주석 참고.
  const { coerceIngredientListUnknown, normalizeIngredient } = await import(
    "@/lib/recommend/normalizeIngredient"
  );

  console.log("식약처 화장품 규제정보를 받는다…");
  const regl = await fetchRegulatedIngredients(serviceKey);
  console.log(`  규제 성분 ${regl.length}행`);

  // 캐논컬 → 규제 정보. 한글명·영문명 둘 다 건다.
  const prohibited = new Map<string, ReglRow>();
  const limited = new Map<string, ReglRow>();
  for (const row of regl) {
    for (const n of [row.INGR_STD_NAME, row.INGR_ENG_NAME]) {
      const c = normalizeIngredient(String(n ?? ""));
      if (!c) continue;
      if (listsKorea(row.PROH_NATIONAL)) prohibited.set(c, row);
      else if (listsKorea(row.LIMIT_NATIONAL)) limited.set(c, row);
    }
  }
  console.log(`  그중 한국 금지 ${prohibited.size}종 · 한국 제한 ${limited.size}종 (캐논컬 기준)\n`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAllProducts(client);
  const pool = products.filter(isInRecommendationPool);
  const withIngredients = products.filter(
    (p) => coerceIngredientListUnknown(p.full_ingredients).length > 0
  );

  console.log(`제품 ${products.length}행 · 전성분 있음 ${withIngredients.length}행 · 추천 풀 ${pool.length}행\n`);

  const hits: Array<{
    product: Product;
    kind: "금지" | "제한";
    label: string;
    stdName: string;
    countries: string;
  }> = [];

  for (const p of withIngredients) {
    for (const label of coerceIngredientListUnknown(p.full_ingredients)) {
      const c = normalizeIngredient(label);
      if (!c) continue;
      // 완전 일치만 본다 — 느슨하게 보면 이름이 비슷한 성분에 잘못된 딱지가 붙는다.
      const proh = prohibited.get(c);
      if (proh) {
        hits.push({
          product: p,
          kind: "금지",
          label,
          stdName: String(proh.INGR_STD_NAME ?? proh.INGR_ENG_NAME ?? ""),
          countries: String(proh.PROH_NATIONAL ?? ""),
        });
        continue;
      }
      const lim = limited.get(c);
      if (lim) {
        hits.push({
          product: p,
          kind: "제한",
          label,
          stdName: String(lim.INGR_STD_NAME ?? lim.INGR_ENG_NAME ?? ""),
          countries: String(lim.LIMIT_NATIONAL ?? ""),
        });
      }
    }
  }

  const banned = hits.filter((h) => h.kind === "금지");
  const limitedHits = hits.filter((h) => h.kind === "제한");
  const inPool = banned.filter((h) => isInRecommendationPool(h.product));

  console.log("═".repeat(70));
  console.log("이 결과를 경보로 쓰지 말 것 — 이 데이터로는 제품 단위 판정이 안 된다.");
  console.log("═".repeat(70));
  console.log(`  이름 적중: 금지 표시 ${banned.length}건 · 제한 표시 ${limitedHits.length}건`);
  console.log(`  그중 추천 풀 제품 ${inPool.length}건`);

  // 판정 불가 근거를 매 실행마다 숫자로 다시 보여준다 — 나중에 이 목록을 보고
  // «금지 성분이 있다» 고 오해하는 것을 막는다.
  const korProhRows = regl.filter((r) => listsKorea(r.PROH_NATIONAL)).length;
  const conditional = regl.filter(
    (r) =>
      listsKorea(r.PROH_NATIONAL) &&
      /초과|이상|미만|이하|경우|제외|한하여|limitation|requirement|less than|more than/i.test(
        `${r.INGR_STD_NAME ?? ""} ${r.INGR_ENG_NAME ?? ""}`
      )
  ).length;
  console.log("\n  ── 판정이 안 되는 이유 ──");
  console.log(`  · 규제 목록 ${regl.length}행 중 한국을 금지국으로 다는 것이 ${korProhRows}행 ` +
    `(${Math.round((korProhRows / Math.max(regl.length, 1)) * 100)}%) — 단순 금지 목록이라면 나올 수 없는 비율`);
  console.log(`  · 그중 ${conditional}행은 **조건이 이름 안에 박혀 있다** ` +
    `(예: «과산화물가가 10mmol/L을 초과하는 …»). 이름만 맞추면 정상 제품이 걸린다`);
  if (inPool.length > 0) {
    const brands = [...new Set(inPool.map((h) => String(h.product.brand)))].join(" · ");
    console.log(`  · 적중한 제품의 브랜드: ${brands}`);
    console.log("    국내 정식 유통 브랜드다. 정말 금지라면 이 제품들이 존재할 수 없다");
  }

  console.log("\n  ── 이름 적중 목록 (참고용, 경보 아님) ──");
  for (const h of inPool.slice(0, 15))
    console.log(
      `    ${String(h.product.id).padStart(4)} ${String(h.product.brand).padEnd(16)} ` +
        `«${h.label}» → ${h.stdName.slice(0, 40)}`
    );
  if (inPool.length > 15) console.log(`    … 외 ${inPool.length - 15}건`);

  console.log("\n  다음 단계는 사람 판단이다 — 식약처에 필드 의미를 확인하거나,");
  console.log("  조건까지 담은 데이터셋을 찾거나, 이 경로를 접는다.");

  mkdirSync("artifacts/production-audit", { recursive: true });
  const path = "artifacts/production-audit/prohibited-ingredients.json";
  writeFileSync(
    path,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        source: ENDPOINT,
        regulatedRows: regl.length,
        koreaProhibitedCanonicals: prohibited.size,
        koreaLimitedCanonicals: limited.size,
        productsChecked: withIngredients.length,
        recommendationPoolSize: pool.length,
        usableForProductVerdict: false,
        whyNotUsable:
          "금지 조건이 성분명 안에 박혀 있고(예: «과산화물가가 10mmol/L을 초과하는 …»), " +
          "한국을 금지국으로 다는 행이 전체의 47%다. 이름 대조로는 판정할 수 없다.",
        nameHitsForReferenceOnly: hits.map((h) => ({
          productId: h.product.id,
          brand: h.product.brand,
          name: h.product.name,
          inRecommendationPool: isInRecommendationPool(h.product),
          kind: h.kind,
          matchedLabel: h.label,
          regulatedName: h.stdName,
          countries: h.countries,
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\n결과 저장: ${path}`);

  // 실패로 끝내지 않는다 — 이건 «위험 발견» 이 아니라 «판정 불가» 라는 조사 결과다.
}

main().catch((e) => {
  console.error("[audit-prohibited-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

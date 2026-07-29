/**
 * 단계 0 — Production 189건의 실태 조사. **읽기 전용.**
 *
 * 무엇을 가르는가: 레거시 구매 링크 컬럼(`link_oliveyoung` 등)이 채워져 있으면
 * «아는 URL 을 검증» 하는 일(경로 A)이고, 비어 있으면 «자사몰부터 탐색» 하는
 * 일(경로 B)이다. 난이도가 완전히 다르다.
 *
 * 함께 본다: 활성화 게이트가 오퍼 말고도 요구하는 전성분·성분링크 보유 현황.
 * Staging 실측에서 병목이 판매처가 아니라 성분이었기 때문이다.
 *
 * 자격증명은 anon(publishable) 키면 충분하다 — 공개 카탈로그 읽기다.
 *   PRODUCTION_SUPABASE_URL
 *   PRODUCTION_SUPABASE_ANON_KEY  (또는 PRODUCTION_SUPABASE_SERVICE_ROLE_KEY)
 *
 * 실행: npm run check:production-offer-gap
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

const LINK_COLUMNS = [
  ["올리브영", "link_oliveyoung"],
  ["쿠팡", "link_coupang"],
  ["아마존US", "link_amazon_us"],
  ["아마존JP", "link_amazon_jp"],
  ["큐텐", "link_qoo10"],
  ["예스스타일", "link_yesstyle"],
  ["세포라", "link_sephora"],
] as const;

function mask(ref: string): string {
  return ref.length > 7 ? `${ref.slice(0, 4)}***${ref.slice(-3)}` : "***";
}

function pad(value: string, width: number): string {
  let w = 0;
  for (const ch of value) w += /[가-힯　-ヿ＀-￯]/.test(ch) ? 2 : 1;
  return value + " ".repeat(Math.max(1, width - w));
}

/** PostgREST 는 1000행에서 잘린다 — 끝까지 넘긴다. */
async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_ANON_KEY ??
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (!url || !key) {
    console.log("Production 자격증명 없음 — 조회하지 않고 중단.");
    process.exitCode = 2;
    return;
  }
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) {
    console.error(`ABORT: ref(${mask(ref)})가 기대값과 다르다. 조회하지 않는다.`);
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  console.log(`Production(${mask(ref)}) 단계 0 — 읽기 전용\n`);

  const cols = [
    "id",
    "brand",
    "name",
    "category",
    "active",
    "verified_at",
    "price_usd",
    "created_at",
    "key_ingredients",
    "full_ingredients",
    ...LINK_COLUMNS.map(([, c]) => c),
  ].join(",");

  const products = await fetchAll<Record<string, unknown>>(client, "products", cols);
  const stuck = products.filter((p) => p.verified_at == null);

  console.log(`products 전체 ${products.length}건 · verified_at 없음 ${stuck.length}건\n`);

  // ── (나) 경로 A/B 판정
  console.log("── 레거시 구매 링크 보유 (미검증 대상) ──");
  const has = (p: Record<string, unknown>, c: string) =>
    p[c] != null && String(p[c]).trim() !== "";
  for (const [label, col] of LINK_COLUMNS) {
    console.log(`  ${pad(label, 14)}${String(stuck.filter((p) => has(p, col)).length).padStart(4)}`);
  }
  const anyLink = stuck.filter((p) => LINK_COLUMNS.some(([, c]) => has(p, c))).length;
  console.log(`  ${pad("링크 하나라도", 14)}${String(anyLink).padStart(4)}  ← 경로 A 가능 건수`);
  console.log(
    `\n  판정: ${anyLink > stuck.length * 0.5 ? "경로 A (아는 URL 검증)" : anyLink === 0 ? "경로 B (자사몰 탐색)" : "혼합 — 링크 있는 것부터 A, 나머지 B"}`
  );

  // ── 활성화 게이트가 요구하는 나머지
  const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
  console.log("\n── 활성화에 필요한 다른 조건 (오퍼 외) ──");
  console.log(`  key_ingredients 있음   ${stuck.filter((p) => arr(p.key_ingredients).length > 0).length}`);
  console.log(`  full_ingredients 있음  ${stuck.filter((p) => arr(p.full_ingredients).length > 0).length}  ← 게이트 필수`);

  // ── (가) 브랜드 분포
  console.log("\n── 브랜드 분포 (미검증) ──");
  const brands = new Map<string, number>();
  for (const p of stuck) brands.set(String(p.brand ?? "(없음)"), (brands.get(String(p.brand ?? "(없음)")) ?? 0) + 1);
  for (const [b, n] of [...brands.entries()].sort((x, y) => y[1] - x[1]))
    console.log(`  ${pad(b.slice(0, 26), 28)}${String(n).padStart(4)}`);

  // ── (다) 카테고리·시점
  console.log("\n── 카테고리 분포 ──");
  const cats = new Map<string, number>();
  for (const p of stuck) cats.set(String(p.category ?? "(없음)"), (cats.get(String(p.category ?? "(없음)")) ?? 0) + 1);
  for (const [c, n] of [...cats.entries()].sort((x, y) => y[1] - x[1]).slice(0, 15))
    console.log(`  ${pad(c.slice(0, 26), 28)}${String(n).padStart(4)}`);

  const dates = stuck.map((p) => String(p.created_at ?? "")).filter(Boolean).sort();
  if (dates.length > 0) {
    console.log(`\n  생성 시점: ${dates[0].slice(0, 10)} ~ ${dates[dates.length - 1].slice(0, 10)}`);
  }
  console.log(`  price_usd 있음: ${stuck.filter((p) => p.price_usd != null).length} / ${stuck.length}`);

  // ── 오퍼 실측
  const offers = await fetchAll<{ product_id: string }>(client, "product_offers", "id,product_id");
  console.log(`\n  product_offers 전체 ${offers.length}건`);
}

main().catch((e) => {
  console.error("[survey-production-offer-gap] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

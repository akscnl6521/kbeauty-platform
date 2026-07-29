/**
 * 오퍼가 없어 막혀 있는 제품의 실태 조사. **읽기 전용.**
 *
 * Production 189건과 같은 상태(«정상 시드인데 판매처가 0건»)가 Staging 에도
 * 있는지 보고, 브랜드별로 오퍼 확보가 되는 곳/안 되는 곳을 실측한다.
 * Production 작업을 시작하기 전의 예행 연습이자 수율 근거다.
 *
 * 함께 보는 것: 레거시 구매 링크 컬럼(`link_oliveyoung` 등)이 채워져 있는지.
 * 채워져 있으면 «브랜드몰을 뒤지는» 일이 아니라 «아는 URL 을 검증하는» 일이 된다.
 *
 * 실행: npm run check:offer-missing-survey
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const PROD_REF = "rhfrmvkjsummaylpzmns";

const LINK_COLUMNS = [
  ["올리브영", "link_oliveyoung"],
  ["쿠팡", "link_coupang"],
  ["아마존US", "link_amazon_us"],
  ["아마존JP", "link_amazon_jp"],
  ["큐텐", "link_qoo10"],
  ["예스스타일", "link_yesstyle"],
  ["세포라", "link_sephora"],
] as const;

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

function pad(value: string, width: number): string {
  let w = 0;
  for (const ch of value) w += /[가-힯　-ヿ＀-￯]/.test(ch) ? 2 : 1;
  return value + " ".repeat(Math.max(1, width - w));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");

  const client = createClient(url, key, { auth: { persistSession: false } });

  const cols = [
    "id",
    "brand",
    "name",
    "active",
    "verified_at",
    "price_usd",
    "category",
    "created_at",
    ...LINK_COLUMNS.map(([, c]) => c),
  ].join(",");

  const products = await fetchAll<Record<string, unknown>>(client, "products", cols);
  const offers = await fetchAll<{
    product_id: string;
    verification_status: string | null;
    stock_status: string | null;
    retailer_country: string | null;
  }>(
    client,
    "product_offers",
    "id,product_id,verification_status,stock_status,retailer_country"
  );

  const offersByProduct = new Map<string, typeof offers>();
  for (const o of offers) {
    const k = String(o.product_id);
    const list = offersByProduct.get(k) ?? [];
    list.push(o);
    offersByProduct.set(k, list);
  }
  const verifiedInStock = new Set(
    offers
      .filter((o) => o.verification_status === "verified" && o.stock_status === "in_stock")
      .map((o) => String(o.product_id))
  );

  const total = products.length;
  const active = products.filter((p) => p.active === true && p.verified_at != null);
  const noOffer = products.filter((p) => !offersByProduct.has(String(p.id)));
  /** Production 189건과 같은 상태: 미검증 + 오퍼 0건 */
  const stuck = products.filter(
    (p) => p.verified_at == null && !offersByProduct.has(String(p.id))
  );

  console.log(`Staging 제품 ${total}건`);
  console.log(`  활성(active + verified)          ${active.length}`);
  console.log(`  오퍼 0건                          ${noOffer.length}`);
  console.log(`  **미검증 + 오퍼 0건 (=Production 189건과 같은 상태)  ${stuck.length}**`);
  console.log(`  verified in_stock 오퍼 보유       ${verifiedInStock.size}`);

  // ── 레거시 구매 링크 — 경로 A/B 를 가르는 값
  console.log(`\n── 레거시 구매 링크 보유 (미검증+오퍼0 ${stuck.length}건 기준) ──`);
  let anyLink = 0;
  for (const p of stuck) {
    if (LINK_COLUMNS.some(([, c]) => p[c] != null && String(p[c]).trim() !== "")) anyLink += 1;
  }
  for (const [label, col] of LINK_COLUMNS) {
    const n = stuck.filter((p) => p[col] != null && String(p[col]).trim() !== "").length;
    console.log(`  ${pad(label, 14)}${String(n).padStart(4)}`);
  }
  console.log(`  ${pad("링크 하나라도", 14)}${String(anyLink).padStart(4)}  ← 경로 A 가능 건수`);

  // ── 브랜드별 오퍼 확보 실적 = 수율 근거
  console.log(`\n── 브랜드별 오퍼 확보 실적 (수율 근거) ──`);
  console.log(`  ${pad("브랜드", 22)}${"전체".padStart(5)}${"오퍼보유".padStart(9)}${"활성".padStart(6)}${"막힘".padStart(6)}`);
  const brands = new Map<string, { total: number; withOffer: number; active: number; stuck: number }>();
  for (const p of products) {
    const b = String(p.brand ?? "(없음)");
    const e = brands.get(b) ?? { total: 0, withOffer: 0, active: 0, stuck: 0 };
    e.total += 1;
    if (offersByProduct.has(String(p.id))) e.withOffer += 1;
    if (p.active === true && p.verified_at != null) e.active += 1;
    if (p.verified_at == null && !offersByProduct.has(String(p.id))) e.stuck += 1;
    brands.set(b, e);
  }
  for (const [b, e] of [...brands.entries()].sort((x, y) => y[1].stuck - x[1].stuck || y[1].total - x[1].total)) {
    console.log(
      `  ${pad(b.slice(0, 20), 22)}${String(e.total).padStart(5)}${String(e.withOffer).padStart(9)}` +
        `${String(e.active).padStart(6)}${String(e.stuck).padStart(6)}`
    );
  }

  // ── 막힌 제품의 성격
  console.log(`\n── 막힌 ${stuck.length}건의 성격 ──`);
  const withPrice = stuck.filter((p) => p.price_usd != null).length;
  const withCategory = stuck.filter((p) => p.category != null).length;
  const dates = stuck.map((p) => String(p.created_at ?? "")).filter(Boolean).sort();
  console.log(`  price_usd 있음    ${withPrice}  (오퍼 가격으로 쓰지 않는다 — 검증된 판매처 가격이 아님)`);
  console.log(`  category 있음     ${withCategory}`);
  if (dates.length > 0) {
    console.log(`  생성 시점         ${dates[0].slice(0, 10)} ~ ${dates[dates.length - 1].slice(0, 10)}`);
  }
}

main().catch((e) => {
  console.error("[survey-offer-missing-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

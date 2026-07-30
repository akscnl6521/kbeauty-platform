/**
 * 네이버 쇼핑 검색으로 **국내 판매처(KR offer)와 한글 제품명**을 확보한다.
 *
 * 왜 네이버인가 — 국내몰은 상품명이 한국어라 영문 DB 명과 매칭이 안 되고
 * (영문명 병기도 없다), 올리브영은 검색 경로가 403 이다. 네이버 쇼핑은 공개 API 로
 * 쿠팡·올리브영·11번가를 **통합 색인**하므로 한 곳만 붙이면 된다.
 *
 * 판매처는 **아무거나 쓰지 않는다.** 개인 재판매상·병행수입이 결과에 섞여 있어
 * 신뢰할 수 있는 곳만 남긴다(§오퍼 게이트의 마켓플레이스 셀러 배제와 같은 취지).
 *
 * `--apply` 없이 실행하면 무엇을 얻었는지만 출력한다. DB 쓰기 없음.
 *
 * 실행: npm run collect:kr-offers -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { koreanProductNameToComparable } from "../src/lib/catalog/koreanProductTerms";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const API = "https://openapi.naver.com/v1/search/shop.json";

/**
 * 신뢰할 수 있는 국내 판매처.
 *
 * `네이버` 는 네이버 스마트스토어 묶음이라 그 자체로는 판매자를 알 수 없어 **제외**한다.
 * 개인 재판매상(`부띠끄라인` · `정약찜몰` 등)도 제외 — 공식 유통 경로가 아니다.
 */
const TRUSTED_MALLS = new Set(["올리브영", "쿠팡", "롯데ON", "SSG.COM", "신세계몰", "롯데닷컴"]);

/** 브랜드 한글 표기. 네이버 검색으로 자동 확보하고, 확인된 것만 쓴다. */
type BrandMap = { en: string; ko: string; evidence: string };

type NaverItem = {
  title: string;
  link: string;
  lprice: string;
  mallName: string;
  brand: string;
  maker: string;
  productId: string;
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

async function search(
  query: string,
  display = 30
): Promise<NaverItem[]> {
  const id = process.env.NAVER_SEARCH_CLIENT_ID ?? "";
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET ?? "";
  const u = `${API}?query=${encodeURIComponent(query)}&display=${display}`;
  try {
    const r = await fetch(u, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { items?: NaverItem[] };
    return j.items ?? [];
  } catch {
    return [];
  }
}

/**
 * 제품명 비교용 토큰.
 *
 * 국내 제품명은 영문 음역이라(`라이트웨이트` = lightweight) 그대로 비교하면 안 맞는다.
 * 음역 사전으로 영문으로 되돌린 뒤 토큰을 뽑는다.
 */
function tokens(raw: string): Set<string> {
  const s = koreanProductNameToComparable(raw)
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*(ml|g|매|개|ea|호|fl\s*oz)\b/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ");
  return new Set(s.split(/\s+/).filter((t) => t.length >= 2));
}

function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n / Math.min(a.size, b.size);
}

/**
 * 세트·묶음·기획 상품을 걸러낸다.
 *
 * 단품 오퍼 자리에 세트 가격을 넣으면 사용자가 보는 가격이 틀린다. 2026-07-30
 * 실측에서 «COSRX SET 더 레티놀 0.1 크림 20ml x 2개» 98,400원이 단품으로 잡혔다.
 */
const BUNDLE_MARKERS =
  /(?:set|bundle|pack)|세트|기획|묶음|증정|사은품|더블|듀오|리필\s*포함|\d+\s*개입|(?:^|[^\d])[2-9]\d*\s*개(?![월년])|x\s*\d+\s*개|\+\s*\d+\s*개/i;

function looksLikeBundle(title: string): boolean {
  return BUNDLE_MARKERS.test(title);
}

/**
 * 제목에 **브랜드가 들어 있는지** 확인한다. 없으면 다른 브랜드 제품일 수 있다.
 * 실측에서 `블랙라이스 페이셜 오일 10ml` 처럼 브랜드가 없는 결과가 잡혔다.
 */
function titleHasBrand(title: string, brandEn: string, brandKo?: string): boolean {
  const t = title.toLowerCase();
  const en = brandEn.toLowerCase().replace(/[^a-z0-9]/g, "");
  const flat = t.replace(/[^a-z0-9가-힣]/g, "");
  if (en.length >= 3 && flat.includes(en)) return true;
  if (brandKo && flat.includes(brandKo.replace(/[^a-z0-9가-힣]/g, ""))) return true;
  return false;
}

/**
 * 국내 가격이 타당한지 **미국 오퍼 가격과 대조**해서 본다.
 *
 * 병행수입·해외직구가 정가의 몇 배로 올라오는 경우가 있다(실측: 어성초 토너
 * 75,300원, 정가의 3배 이상). 같은 제품의 US 가격이 있으면 그것을 기준으로 삼는다.
 * 환율은 넉넉히 잡고, **상한을 넘는 것만** 버린다 — 싼 것은 정상 할인일 수 있다.
 */
const KRW_PER_USD_UPPER = 1600;
const PRICE_MULTIPLE_LIMIT = 1.5;

function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  return v[Math.floor(v.length / 2)];
}

function isImplausibleKrPrice(
  krw: number,
  usd: number | null,
  marketMedian: number | null
): { bad: boolean; why: string } {
  if (krw < 1000) return { bad: true, why: `${krw}원 — 단품 가격으로 비현실적` };

  // US 가격이 있으면 그것을 기준으로. 국내 브랜드는 보통 국내가 더 싸므로 1.5배까지만 본다.
  if (usd != null && usd > 0) {
    const ceiling = usd * KRW_PER_USD_UPPER * PRICE_MULTIPLE_LIMIT;
    if (krw > ceiling) {
      return { bad: true, why: `${krw}원 — US $${usd} 기준 상한 ${Math.round(ceiling)}원 초과` };
    }
  }

  // US 가격이 없는 제품은 **같은 검색 결과의 중위가격**과 대조한다.
  // 병행수입·해외직구가 시세의 몇 배로 올라오는 것을 자체적으로 걸러낸다.
  if (marketMedian != null && krw > marketMedian * 2) {
    return { bad: true, why: `${krw}원 — 검색 시세 중위 ${marketMedian}원의 2배 초과` };
  }
  return { bad: false, why: "" };
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const nid = process.env.NAVER_SEARCH_CLIENT_ID ?? "";
  if (!url || !key || !nid) {
    console.log(`자격증명 부족 — Production ${url && key ? "있음" : "없음"} · 네이버 ${nid ? "있음" : "없음"}`);
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    name_ko: string | null;
    active: boolean | null;
    verified_at: string | null;
  }>(client, "products", "id,brand,name,name_ko,active,verified_at");
  const targets = products.filter((p) => p.active === true && p.verified_at != null);
  console.log(`활성 제품 ${targets.length}건`);

  // 가격 타당성 대조용 — 같은 제품의 US 오퍼 가격
  const usdByProduct = new Map<number, number>();
  const usOffers = await fetchAll<{ product_id: string; price: number | null; currency: string | null }>(
    client,
    "product_offers",
    "id,product_id,price,currency"
  );
  for (const o of usOffers) {
    if (o.currency !== "USD" || o.price == null) continue;
    const pid = Number(o.product_id);
    if (!usdByProduct.has(pid)) usdByProduct.set(pid, Number(o.price));
  }

  // ── 1. 브랜드 한글 표기 확보
  const brands = [...new Set(targets.map((p) => String(p.brand ?? "")).filter(Boolean))];
  const brandMap = new Map<string, BrandMap>();
  console.log(`\n[1] 브랜드 한글 표기 확보 (${brands.length}개)`);
  for (const en of brands) {
    const items = await search(en, 20);
    // 결과의 brand/maker 중 **한글이 든 것**의 최빈값을 쓴다
    const counts = new Map<string, number>();
    for (const it of items) {
      for (const cand of [it.brand, it.maker]) {
        const v = stripTags(String(cand ?? ""));
        if (!v || !/[가-힣]/.test(v)) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2) {
      brandMap.set(en, { en, ko: best[0], evidence: `네이버 쇼핑 검색 "${en}" 결과 ${best[1]}건에서 최빈` });
      console.log(`  ${en.padEnd(18)} → ${best[0]}  (${best[1]}건)`);
    } else {
      console.log(`  ${en.padEnd(18)} → (확인 안 됨, 영문으로 검색)`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  // ── 2. 제품별 국내 오퍼·한글명
  console.log(`\n[2] 제품별 국내 판매처 검색`);
  type Found = {
    productId: number;
    brand: string;
    name: string;
    nameKo: string | null;
    mall: string;
    price: number;
    link: string;
    similarity: number;
  };
  const found: Found[] = [];
  const rejected: Array<{ productId: number; reason: string; best?: string }> = [];

  for (const p of targets) {
    const en = String(p.brand ?? "");
    const ko = brandMap.get(en)?.ko;
    const query = `${ko ?? en} ${String(p.name ?? "")}`.trim();
    const items = await search(query, 30);
    const want = tokens(String(p.name ?? ""));

    // 신뢰 판매처 + 제품명 유사도 상위
    const usd = usdByProduct.get(p.id) ?? null;
    // 시세 기준선 — 이 검색 결과 전체(판매처 무관)의 중위가격
    const marketMedian = median(items.map((it) => Number(it.lprice)));
    const scored = items
      .map((it) => ({ it, title: stripTags(it.title) }))
      .map((x) => ({ ...x, sim: containment(want, tokens(x.title)) }))
      .filter((x) => TRUSTED_MALLS.has(stripTags(x.it.mallName)))
      .sort((a, b) => b.sim - a.sim);

    // 유사도만 높다고 쓰지 않는다. 세트·브랜드 불일치·비현실 가격을 먼저 빼고,
    // **남은 후보 중 최저가**를 고른다 — 사용자에게도 그게 맞고, 부풀린 매물을
    // 자연히 피한다(유사도 최고를 고르면 시세보다 비싼 것이 뽑히곤 했다).
    let why = "신뢰 판매처 결과 없음";
    const passing = scored.filter((cand) => {
      if (cand.sim < 0.5) {
        if (why === "신뢰 판매처 결과 없음") why = `유사도 ${cand.sim.toFixed(2)} 미달`;
        return false;
      }
      if (looksLikeBundle(cand.title)) {
        why = "세트·묶음 상품";
        return false;
      }
      if (!titleHasBrand(cand.title, en, ko)) {
        why = "제목에 브랜드 없음";
        return false;
      }
      const plaus = isImplausibleKrPrice(Number(cand.it.lprice), usd, marketMedian);
      if (plaus.bad) {
        why = plaus.why;
        return false;
      }
      return true;
    });
    const hit = passing.sort((a, b) => Number(a.it.lprice) - Number(b.it.lprice))[0];
    if (!hit) {
      rejected.push({
        productId: p.id,
        reason: why,
        best: scored[0]?.title.slice(0, 40),
      });
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    found.push({
      productId: p.id,
      brand: en,
      name: String(p.name ?? ""),
      nameKo: hit.title,
      mall: stripTags(hit.it.mallName),
      price: Number(hit.it.lprice),
      link: hit.it.link,
      similarity: Number(hit.sim.toFixed(2)),
    });
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n확보 ${found.length}건 · 미확보 ${rejected.length}건`);
  for (const f of found)
    console.log(
      `  ${String(f.productId).padStart(4)} ${f.mall.padEnd(8)}${String(f.price).padStart(8)}원  ${f.nameKo?.slice(0, 40)}  (유사도 ${f.similarity})`
    );
  if (rejected.length > 0) {
    console.log("\n미확보:");
    for (const r of rejected)
      console.log(`  ${String(r.productId).padStart(4)} ${r.reason}${r.best ? ` — 최고: ${r.best}` : ""}`);
  }

  mkdirSync("artifacts/kr-offers", { recursive: true });
  const path = `artifacts/kr-offers/naver-${stamp()}.json`;
  writeFileSync(
    path,
    JSON.stringify({ collectedAt: new Date().toISOString(), brandMap: [...brandMap.values()], found, rejected }, null, 2),
    "utf8"
  );
  console.log(`\n결과 저장: ${path}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 Production 에 반영한다.");
    return;
  }
  if (found.length === 0) return;

  // ── 3. Production 반영 (오퍼 + name_ko)
  const nowIso = new Date().toISOString();
  let offersInserted = 0;
  let nameKoSet = 0;
  for (const f of found) {
    // 같은 URL 오퍼가 이미 있으면 건너뛴다
    const { data: dup } = await client
      .from("product_offers")
      .select("id")
      .eq("product_id", String(f.productId))
      .eq("purchase_url", f.link)
      .limit(1);
    if ((dup ?? []).length === 0) {
      const { error } = await client.from("product_offers").insert({
        product_id: String(f.productId),
        retailer_name: f.mall,
        retailer_country: "KR",
        ships_to_countries: ["KR"],
        purchase_url: f.link,
        price: f.price,
        currency: "KRW",
        stock_status: "in_stock",
        verification_status: "verified",
        is_official: TRUSTED_MALLS.has(f.mall),
        verified_at: nowIso,
        last_checked_at: nowIso,
        source: "naver_shopping",
      });
      if (error) console.log(`  ${f.productId} 오퍼 실패: ${error.code} ${error.message.slice(0, 50)}`);
      else offersInserted += 1;
    }

    // 한글 제품명 — 비어 있을 때만 채운다
    if (f.nameKo) {
      const { data } = await client
        .from("products")
        .update({ name_ko: f.nameKo })
        .eq("id", f.productId)
        .is("name_ko", null)
        .select("id");
      if ((data ?? []).length > 0) nameKoSet += 1;
    }
  }

  const { count } = await client.from("product_offers").select("*", { count: "exact", head: true });
  const kr = await client
    .from("product_offers")
    .select("*", { count: "exact", head: true })
    .eq("retailer_country", "KR");
  console.log(`\n오퍼 추가 ${offersInserted} · name_ko ${nameKoSet}건 · 오퍼 총 ${count} (KR ${kr.count})`);
}

main().catch((e) => {
  console.error("[collect-kr-offers-naver] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

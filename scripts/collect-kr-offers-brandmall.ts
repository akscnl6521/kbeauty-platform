/**
 * **브랜드 국내 공식몰**에서 국내 오퍼(원화 가격·재고·구매 링크)를 수집한다.
 *
 * ## 왜 이 경로인가
 *
 * 네이버 쇼핑 API 가 폐지되어(§50) 국내 오퍼 수집이 끊겼다. 남은 길을 찾다가
 * **국내 공식몰이 `sitemap.xml` 로 제품 목록을, 제품 페이지가 JSON-LD 로 가격·재고를**
 * 공개한다는 것을 확인했다(2026-08-04 실측).
 *
 * 검색이 필요 없다 — 사이트맵은 크롤러가 읽으라고 두는 것이고, JSON-LD 는 구조화
 * 데이터라 파싱이 확실하다. 올리브영·쿠팡처럼 봇 차단(403)도 없다.
 *
 * ## 판매처 신뢰성
 *
 * **브랜드 공식몰이므로 정의상 신뢰할 수 있다.** 네이버 경로에서 문제였던
 * 개인 재판매상·병행수입이 섞일 여지가 없다. `is_official = true` 로 넣는다.
 *
 * ## 지어내지 않는다
 *
 *   · 한글 제품명 ↔ 영문 DB 명 대조가 `NAME_MATCH_MIN` 미만이면 **붙이지 않는다.**
 *     엉뚱한 제품의 가격을 붙이면 사용자가 다른 것을 산다.
 *   · JSON-LD 의 `availability` 가 `InStock` 이 아니면 오퍼로 넣지 않는다.
 *     구매 CTA 는 재고가 있어야 뜬다(§productOffer 의 KR 규칙).
 *   · 가격·통화·URL 은 페이지가 준 값 그대로 쓴다. 추정하지 않는다.
 *
 * 실행: npm run collect:kr-offers-mall -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { koreanProductNameToComparable } from "../src/lib/catalog/koreanProductTerms";
import { nameSimilarity, nameTokens, NAME_MATCH_MIN } from "../src/lib/catalog/brandGlobalStores";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/**
 * 브랜드 → 국내 공식몰. **사이트맵이 실제로 제품 URL 을 돌려주는 것만** 넣는다
 * (2026-08-04 확인). 도메인이 비슷하다고 추측해서 넣지 않는다.
 */
const KR_MALLS: ReadonlyArray<{ brands: string[]; domain: string }> = [
  { brands: ["COSRX", "CosRX"], domain: "www.cosrx.co.kr" },
  { brands: ["Round Lab", "ROUND LAB"], domain: "roundlab.co.kr" },
  { brands: ["Klairs"], domain: "klairs.co.kr" },
  { brands: ["Laneige"], domain: "www.laneige.com" },
  { brands: ["Abib", "Abib Cosmetic"], domain: "abib.co.kr" },
];

type Product = { id: number; brand: string | null; name: string | null; name_ko: string | null };
type MallItem = { url: string; name: string; price: number; currency: string; inStock: boolean };

function decodeXml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

async function get(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}

/** 제품 페이지의 JSON-LD 에서 이름·가격·재고를 뽑는다. 없으면 null. */
function parseProductJsonLd(html: string): Omit<MallItem, "url"> | null {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1]
  );
  for (const raw of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const n of nodes) {
      const node = n as Record<string, unknown>;
      if (node["@type"] !== "Product") continue;
      const name = String(node.name ?? "").trim();
      const offersRaw = node.offers;
      const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw) as
        | Record<string, unknown>
        | undefined;
      if (!name || !offer) continue;
      const price = Number(offer.price);
      const currency = String(offer.priceCurrency ?? "").toUpperCase();
      const avail = String(offer.availability ?? "");
      if (!Number.isFinite(price) || price <= 0) continue;
      return { name, price, currency, inStock: /InStock/i.test(avail) && !/OutOfStock/i.test(avail) };
    }
  }
  return null;
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<Product>(client, "products", "id,brand,name,name_ko");
  const existing = await fetchAll<{ product_id: string; retailer_country: string | null; purchase_url: string | null }>(
    client,
    "product_offers",
    "id,product_id,retailer_country,purchase_url"
  );
  const hasKrOffer = new Set(
    existing.filter((o) => o.retailer_country === "KR").map((o) => String(o.product_id))
  );

  const found: Array<{ product: Product; item: MallItem; sim: number; domain: string }> = [];

  for (const mall of KR_MALLS) {
    const mine = products.filter((p) => mall.brands.includes(String(p.brand ?? "")));
    if (mine.length === 0) continue;

    const sm = await get(`https://${mall.domain}/sitemap.xml`);
    const urls = [
      ...new Set(
        [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)]
          .map((m) => decodeXml(m[1]))
          .filter((u) => /shopdetail|\/product\/|goods|item/i.test(u))
      ),
    ];
    console.log(`\n=== ${mall.brands[0]} (${mall.domain}) — DB 제품 ${mine.length}건 · 몰 URL ${urls.length}개 ===`);
    if (urls.length === 0) continue;

    // 몰 제품을 먼저 다 읽어 목록으로 만든 뒤 대조한다 — 제품마다 몰 전체를 훑지 않는다.
    const items: MallItem[] = [];
    for (const u of urls) {
      const html = await get(u);
      const p = html ? parseProductJsonLd(html) : null;
      if (p) items.push({ url: u, ...p });
      await new Promise((r) => setTimeout(r, 350));
    }
    console.log(`  가격 정보가 있는 제품 ${items.length}개 (그중 재고 있음 ${items.filter((i) => i.inStock).length}개)`);

    for (const p of mine) {
      const want = nameTokens(String(p.name ?? ""), String(p.brand ?? ""));
      let best: { it: MallItem; sim: number } | null = null;
      for (const it of items) {
        // 한글 몰 이름을 비교용 영문으로 바꿔서 대조한다.
        const cmp = koreanProductNameToComparable(it.name);
        const sim = nameSimilarity(want, nameTokens(cmp, String(p.brand ?? "")));
        if (!best || sim > best.sim) best = { it, sim };
      }
      if (!best || best.sim < NAME_MATCH_MIN) continue;
      if (!best.it.inStock) {
        console.log(`  · ${String(p.id).padStart(4)} ${String(p.name).slice(0, 30)} — 몰에 있으나 품절`);
        continue;
      }
      found.push({ product: p, item: best.it, sim: best.sim, domain: mall.domain });
      const mark = hasKrOffer.has(String(p.id)) ? "(이미 국내 오퍼 있음)" : "**신규**";
      console.log(
        `  ✔ ${String(p.id).padStart(4)} ${String(p.name).slice(0, 30).padEnd(32)}` +
          `${String(best.it.price).padStart(8)} ${best.it.currency} 대조 ${best.sim.toFixed(2)} ${mark}`
      );
    }
  }

  const fresh = found.filter((f) => !hasKrOffer.has(String(f.product.id)));
  console.log(`\n확보 ${found.length}건 · 그중 국내 오퍼가 없던 제품 ${fresh.length}건`);

  mkdirSync("artifacts/kr-offers", { recursive: true });
  const path = "artifacts/kr-offers/brandmall.json";
  writeFileSync(
    path,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        found: found.map((f) => ({
          productId: f.product.id,
          brand: f.product.brand,
          name: f.product.name,
          mallName: f.item.name,
          price: f.item.price,
          currency: f.item.currency,
          url: f.item.url,
          similarity: Number(f.sim.toFixed(2)),
          isNew: !hasKrOffer.has(String(f.product.id)),
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`결과 저장: ${path}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 오퍼를 넣는다.");
    return;
  }
  if (fresh.length === 0) return;

  const nowIso = new Date().toISOString();
  let inserted = 0;
  for (const f of fresh) {
    if (f.item.currency !== "KRW") {
      console.log(`  ${f.product.id} 건너뜀 — 통화가 KRW 가 아니다 (${f.item.currency})`);
      continue;
    }
    const { error } = await client.from("product_offers").insert({
      product_id: f.product.id,
      retailer_name: `${f.product.brand} 공식몰`,
      retailer_country: "KR",
      ships_to_countries: ["KR"],
      purchase_url: f.item.url.replace(/^http:/, "https:"),
      price: f.item.price,
      currency: "KRW",
      stock_status: "in_stock",
      verification_status: "verified",
      is_official: true,
      verified_at: nowIso,
      last_checked_at: nowIso,
      source: "brand_official_kr_mall",
      active: true,
    });
    if (error) {
      console.log(`  ${f.product.id} 실패: ${error.code} ${error.message.slice(0, 70)}`);
      continue;
    }
    inserted += 1;
  }
  console.log(`\n국내 오퍼 ${inserted}건 추가`);
}

main().catch((e) => {
  console.error("[collect-kr-offers-brandmall] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

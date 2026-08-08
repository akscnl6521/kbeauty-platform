/**
 * 국내 공식몰 후보 도메인을 **실제로 열어 보고** 쓸 수 있는지 판정한다.
 *
 * ## 왜 탐침이 따로 필요한가
 *
 * `KR_MALLS` 주석에 적어 둔 대로다 — 도메인이 그럴듯하다고 넣으면, 그 몰은 조용히
 * 0건을 돌려주고 우리는 «그 브랜드는 국내에 없다» 고 잘못 판단하게 된다.
 * 라네즈처럼 **사이트맵은 열리는데 가격이 전부 `100`** 인 경우도 있었다.
 *
 * 그래서 등록 전에 네 가지를 눈으로 확인한다:
 *
 *   1. 사이트맵이 열리는가
 *   2. 거기서 **제품 URL** 이 나오는가 (목록·게시판 페이지가 아니라)
 *   3. 제품 페이지가 JSON-LD 로 **가격**을 주는가
 *   4. 그 가격이 자리표시가 아닌가 (`mallPricesLookLikePlaceholders`)
 *
 * 넷을 다 통과한 도메인만 사람이 `KR_MALLS` 에 넣는다. 이 스크립트는 **아무것도
 * 쓰지 않는다** — 공개 페이지 GET 뿐이고 DB 도 건드리지 않는다.
 *
 * 실행: npm run probe:kr-malls -- anua.co.kr torriden.com
 *       npm run probe:kr-malls            (기본 후보 목록)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { decodeHtmlBody } from "../src/lib/catalog/decodeHtmlBody";
import { extractProductUrlsFromSitemap } from "../src/lib/catalog/mallSitemap";
import { parseMallProductJsonLd, mallPricesLookLikePlaceholders } from "../src/lib/catalog/mallProductData";

/**
 * 기본 후보 — 국내에서 널리 팔리는 브랜드의 **공식몰로 알려진** 도메인이다.
 * 여기 있다는 것은 «후보» 라는 뜻일 뿐, 쓸 수 있다는 판정이 아니다.
 * 판정은 이 스크립트의 출력이 한다.
 */
const DEFAULT_CANDIDATES = [
  "www.anua.co.kr",
  "anua.co.kr",
  "torriden.com",
  "www.torriden.com",
  "skin1004.com",
  "www.skin1004.com",
  "numbuzin.com",
  "www.numbuzin.com",
  "beautyofjoseon.com",
  "haruharuwonder.com",
  "goodal.co.kr",
  "www.goodal.co.kr",
  "isntree.com",
  "www.isntree.com",
  "pyunkangyul.com",
  "www.pyunkangyul.com",
  "mixsoon.com",
  "dalba.co.kr",
  "www.dalba.co.kr",
  "manyo.co.kr",
  "www.manyo.co.kr",
];

const SITEMAP_PATHS = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap/sitemap.xml"];
const UA = "Mozilla/5.0 (compatible; KBeautyMatchCatalog/1.0)";
const SAMPLE = 6;
const TIMEOUT_MS = 12_000;

async function get(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: ctl.signal });
    clearTimeout(timer);
    // 국내몰은 EUC-KR 로 주는 곳이 많다 — UTF-8 로 읽으면 한글이 전부 깨진다.
    return { ok: r.ok, status: r.status, text: await decodeHtmlBody(r) };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

type Verdict = {
  domain: string;
  sitemap: string | null;
  productUrls: number;
  priced: number;
  inStock: number;
  placeholderPrices: boolean;
  usable: boolean;
  note: string;
};

async function probe(domain: string): Promise<Verdict> {
  const base: Verdict = {
    domain,
    sitemap: null,
    productUrls: 0,
    priced: 0,
    inStock: 0,
    placeholderPrices: false,
    usable: false,
    note: "",
  };

  let urls: string[] = [];
  for (const path of SITEMAP_PATHS) {
    const res = await get(`https://${domain}${path}`);
    if (!res.ok || !res.text.trimStart().startsWith("<")) continue;
    // 인덱스 사이트맵이면 하위 사이트맵을 한 겹 더 따라간다.
    const found = extractProductUrlsFromSitemap(res.text, domain);
    if (found.length > 0) {
      base.sitemap = path;
      urls = found;
      break;
    }
    const children = [...res.text.matchAll(/<loc>\s*([^<\s]+\.xml[^<\s]*)\s*<\/loc>/gi)]
      .map((m) => m[1])
      .slice(0, 5);
    for (const child of children) {
      const sub = await get(child);
      if (!sub.ok) continue;
      const subFound = extractProductUrlsFromSitemap(sub.text, domain);
      if (subFound.length > 0) {
        base.sitemap = `${path} → ${child.replace(/^https?:\/\/[^/]+/, "")}`;
        urls = subFound;
        break;
      }
    }
    if (urls.length > 0) break;
  }

  if (!base.sitemap) {
    base.note = "사이트맵을 못 찾음";
    return base;
  }
  base.productUrls = urls.length;
  if (urls.length === 0) {
    base.note = "사이트맵은 열리나 제품 URL 이 없음";
    return base;
  }

  const prices: number[] = [];
  for (const u of urls.slice(0, SAMPLE)) {
    const page = await get(u);
    if (!page.ok) continue;
    const parsed = parseMallProductJsonLd(page.text);
    if (!parsed?.price) continue;
    base.priced += 1;
    prices.push(parsed.price);
    if (parsed.inStock) base.inStock += 1;
  }

  if (base.priced === 0) {
    base.note = `제품 ${urls.length}건이나 JSON-LD 가격이 없음 (${SAMPLE}건 표본)`;
    return base;
  }

  base.placeholderPrices = mallPricesLookLikePlaceholders(prices);
  if (base.placeholderPrices) {
    base.note = "가격이 자리표시로 보임 — 라네즈와 같은 사례";
    return base;
  }

  base.usable = true;
  base.note =
    base.inStock === 0
      ? "가격은 정상이나 재고(availability)를 안 줌 — 재고를 추측하면 안 되므로 반쪽"
      : "사용 가능";
  return base;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const candidates = args.length > 0 ? args : DEFAULT_CANDIDATES;
  console.log(`후보 ${candidates.length}개를 확인한다.\n`);

  const results: Verdict[] = [];
  for (const d of candidates) {
    const v = await probe(d);
    results.push(v);
    const mark = v.usable ? (v.inStock > 0 ? "OK  " : "반쪽") : "  X ";
    console.log(
      `${mark} ${d.padEnd(24)} 제품URL ${String(v.productUrls).padStart(4)} · ` +
        `가격 ${v.priced}/${SAMPLE} · 재고 ${v.inStock}  ${v.note}`
    );
  }

  const usable = results.filter((r) => r.usable && r.inStock > 0);
  console.log(`\n바로 쓸 수 있는 몰 ${usable.length}개: ${usable.map((r) => r.domain).join(", ") || "(없음)"}`);
  const half = results.filter((r) => r.usable && r.inStock === 0);
  if (half.length > 0)
    console.log(`재고를 안 주는 몰 ${half.length}개: ${half.map((r) => r.domain).join(", ")} — 재고를 지어내지 않는다`);

  mkdirSync("artifacts/kr-malls", { recursive: true });
  writeFileSync(
    "artifacts/kr-malls/probe.json",
    JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2),
    "utf8"
  );
  console.log("\n결과 저장: artifacts/kr-malls/probe.json");
  console.log("통과한 도메인만 src/lib/catalog/krMalls.ts 에 넣는다.");
}

main().catch((e) => {
  console.error("[probe-kr-mall-candidates] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

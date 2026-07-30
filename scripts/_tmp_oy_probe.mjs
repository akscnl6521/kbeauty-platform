/**
 * 올리브영 검색이 **영문 제품명**으로 국내 상품을 찾아주는지 확인한다.
 * robots.txt 가 /store/search · /store/goods 를 명시적으로 허용한다 (Crawl-delay 5).
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function get(u) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko" } });
    return { status: r.status, body: r.ok ? await r.text() : "" };
  } catch (e) {
    return { status: 0, body: "" };
  }
}

const QUERIES = [
  "COSRX Hydrium Watery Toner",
  "COSRX 하이드리움",
  "COSRX",
  "Anua Heartleaf Soothing Toner",
  "어성초 토너",
  "Torriden Dive In Serum",
];

for (const q of QUERIES) {
  const url = `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(q)}`;
  const r = await get(url);
  const body = r.body;
  // 검색 결과 상품 링크·이름 추출
  const goodsNos = [...new Set([...body.matchAll(/goodsNo=([A-Z0-9]+)/g)].map((m) => m[1]))];
  const names = [...body.matchAll(/class="tx_name"[^>]*>([^<]{4,80})</g)].map((m) => m[1].trim());
  const brands = [...body.matchAll(/class="tx_brand"[^>]*>([^<]{2,40})</g)].map((m) => m[1].trim());
  console.log(`\n"${q}"  HTTP ${r.status}`);
  console.log(`  상품번호 ${goodsNos.length}개 · 이름 ${names.length}개`);
  for (let i = 0; i < Math.min(3, names.length); i++) {
    console.log(`     ${(brands[i] ?? "?").slice(0, 16).padEnd(18)}${names[i].slice(0, 46)}`);
  }
  await new Promise((x) => setTimeout(x, 5200)); // robots Crawl-delay 5 준수
}

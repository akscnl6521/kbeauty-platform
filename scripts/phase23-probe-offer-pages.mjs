async function check(url) {
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(30000),
      redirect: "follow",
    });
    const html = await r.text();
    const title = (html.match(/<title>([^<]+)/) || [])[1] || "";
    const og = (html.match(/property="og:title" content="([^"]+)"/) || [])[1] || "";
    const sold = /SOLD OUT|품절|soldout/i.test(html);
    const buyBtn = /구매하기|장바구니|BUY NOW|바로구매/i.test(html);
    const prices = [...html.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/g)]
      .slice(0, 6)
      .map((x) => x[1]);
    const stockHints = [];
    if (/display:\s*none[^>]{0,40}sold/i.test(html)) stockHints.push("sold_hidden?");
    if (/class="[^"]*soldout[^"]*"/i.test(html)) stockHints.push("soldout_class");
    if (/품절상품/i.test(html)) stockHints.push("품절상품");
    return {
      url,
      status: r.status,
      finalUrl: r.url,
      title: title.slice(0, 120),
      og: og.slice(0, 120),
      sold,
      buyBtn,
      prices,
      stockHints,
      len: html.length,
    };
  } catch (e) {
    return { url, error: String(e?.cause?.code || e.message || e) };
  }
}

const candidates = [
  // Haruharu official — known & guessed product nos
  "https://haruharu.com/product/%EB%B8%94%EB%9E%99%EB%9D%BC%EC%9D%B4%EC%8A%A4-%ED%9E%88%EC%95%8C%EB%A3%A8%EB%A1%9C%EB%8B%89-%ED%86%A0%EB%84%88-%EB%AC%B4%ED%96%A5-150ml/517/",
  "https://haruharu.com/product/detail.html?product_no=517",
  "https://haruharu.com/product/detail.html?product_no=116",
  "https://haruharu.com/product/detail.html?product_no=117",
  "https://haruharu.com/product/detail.html?product_no=118",
  "https://haruharu.com/product/detail.html?product_no=200",
  "https://haruharu.com/product/detail.html?product_no=201",
  "https://haruharu.com/product/detail.html?product_no=202",
  "https://haruharu.com/product/detail.html?product_no=210",
  "https://haruharu.com/product/detail.html?product_no=220",
  "https://haruharu.com/product/detail.html?product_no=225",
  "https://haruharu.com/product/detail.html?product_no=230",
  "https://haruharu.com/product/detail.html?product_no=250",
  "https://haruharu.com/product/detail.html?product_no=300",
  "https://haruharu.com/product/detail.html?product_no=350",
  "https://haruharu.com/product/detail.html?product_no=400",
  "https://haruharu.com/product/detail.html?product_no=450",
  "https://haruharu.com/product/detail.html?product_no=500",
  "https://haruharu.com/product/detail.html?product_no=510",
  "https://haruharu.com/product/detail.html?product_no=515",
  "https://haruharu.com/product/detail.html?product_no=516",
  "https://haruharu.com/product/detail.html?product_no=518",
  "https://haruharu.com/product/detail.html?product_no=520",
  "https://haruharu.com/product/detail.html?product_no=530",
  "https://haruharu.com/product/detail.html?product_no=540",
  "https://haruharu.com/product/detail.html?product_no=545",
  "https://haruharu.com/product/detail.html?product_no=550",
  // BOJ
  "https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/",
];

const out = [];
for (const u of candidates) {
  const row = await check(u);
  out.push(row);
  const label = row.error
    ? `ERR ${row.error}`
    : `sold=${row.sold} prices=${(row.prices || []).join("/")} og=${row.og || row.title}`;
  console.log(`[${row.status || "-"}] ${u}\n  ${label}`);
  await new Promise((r) => setTimeout(r, 400));
}

const interesting = out.filter(
  (r) =>
    !r.error &&
    r.status === 200 &&
    /블랙라이스|히알루로닉|토너|청매실|Green Plum/i.test(`${r.title} ${r.og}`)
);
console.log("\n=== INTERESTING ===");
console.log(JSON.stringify(interesting, null, 2));

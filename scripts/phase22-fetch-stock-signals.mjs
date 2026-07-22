import fs from "node:fs";

const urls = [
  ["aestura", "https://www.aestura.com/web/product/view.do?prdSeq=1021"],
  ["roundlab", "https://roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%81%AC%EB%A6%BC-80ml/24/"],
  ["skin1004", "https://brand.naver.com/skin1004/products/253640353"],
  ["boj", "https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/"],
  ["haruharu", "https://haruharuwonder.com/products/haruharuwonder-black-rice-hyaluronic-toner"],
  ["torriden", "https://www.torriden.com/goods/goods_view.php?goodsNo=229"],
];

const soldRe = /SOLD OUT|품절|구매 불가|sold.?out|일시품절|재고\s*없음/gi;
const buyRe = /구매하기|장바구니|Buy now|Add to cart|바로구매/gi;

for (const [name, url] of urls) {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const t = await res.text();
    const sold = [...t.matchAll(soldRe)].map((m) => m[0]);
    const buy = [...t.matchAll(buyRe)].map((m) => m[0]);
    const priceHits = [...t.matchAll(/([0-9]{1,3},[0-9]{3})\s*원/g)].slice(0, 5).map((m) => m[1]);
    console.log(
      JSON.stringify({
        name,
        status: res.status,
        len: t.length,
        soldUnique: [...new Set(sold)].slice(0, 8),
        buyUnique: [...new Set(buy)].slice(0, 8),
        priceHits,
      })
    );
  } catch (e) {
    console.log(JSON.stringify({ name, error: String(e) }));
  }
}

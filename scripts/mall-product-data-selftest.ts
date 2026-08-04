/**
 * 국내몰 제품 데이터 파싱 회귀 테스트.
 *
 * 표본은 전부 2026-08-04 실측이다. 이 규칙들이 «틀린 값이 화면에 나가는 것» 을 막는
 * 마지막 방어선이라, 느슨해지면 곧바로 사용자에게 잘못된 가격·재고가 간다.
 *
 * 실행: npm run test:mall-product-data
 */
import assert from "node:assert/strict";
import {
  cleanMallProductName,
  mallPricesLookLikePlaceholders,
  parseMallProductJsonLd,
  MIN_PLAUSIBLE_KRW,
  type MallProduct,
} from "../src/lib/catalog/mallProductData";

const ld = (obj: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head></html>`;

// ── 이름에서 HTML 을 걷어낸다 (Abib 실측) ──
{
  assert.equal(
    cleanMallProductName("하이드레이션 크림<br /> <strong>워터 튜브</strong>"),
    "하이드레이션 크림 워터 튜브"
  );
  // 태그를 공백으로 바꿔야 한다 — 빈 문자열로 지우면 낱말이 붙는다.
  assert.equal(cleanMallProductName("크림<br />워터"), "크림 워터");
  assert.equal(cleanMallProductName("퀵 선스틱<br /> <strong>SPF50+</strong>"), "퀵 선스틱 SPF50+");
  assert.equal(cleanMallProductName("A&amp;B"), "A&B");
  assert.equal(cleanMallProductName(null), "");
  assert.equal(cleanMallProductName("  여러   공백  "), "여러 공백");
}

// ── 정상 제품 (COSRX 실측 형태) ──
{
  const p = parseMallProductJsonLd(
    ld({
      "@type": "Product",
      name: "갈락토미세스 95 톤 밸런싱 에센스",
      offers: { price: "15725", priceCurrency: "KRW", availability: "https://schema.org/InStock" },
    })
  );
  assert.ok(p);
  assert.equal(p!.name, "갈락토미세스 95 톤 밸런싱 에센스");
  assert.equal(p!.price, 15725);
  assert.equal(p!.currency, "KRW");
  assert.equal(p!.inStock, true);
}

// ── 품절은 재고 있음이 아니다 ──
{
  const p = parseMallProductJsonLd(
    ld({
      "@type": "Product",
      name: "AC 컬렉션 라이트웨이트 수딩 크림",
      offers: { price: "15000", priceCurrency: "KRW", availability: "https://schema.org/OutOfStock" },
    })
  );
  assert.equal(p!.inStock, false);
}

// ── `availability` 가 없으면 **재고 있음으로 보지 않는다** (Round Lab 실측) ──
{
  const p = parseMallProductJsonLd(
    ld({
      "@type": "Product",
      name: "1025 독도 토너 200ml",
      offers: { price: "11900", priceCurrency: "KRW" },
    })
  );
  assert.ok(p);
  assert.equal(
    p!.inStock,
    false,
    "없는 정보를 유리하게 읽으면 품절 제품에 구매 버튼이 붙는다"
  );
}

// ── 배열 형태 JSON-LD · Product 가 아닌 노드가 섞인 경우 ──
{
  const p = parseMallProductJsonLd(
    ld([
      { "@type": "Organization", name: "코스알엑스" },
      { "@type": "BreadcrumbList", itemListElement: [] },
      {
        "@type": "Product",
        name: "스네일 96 뮤신 파워 에센스",
        offers: [{ price: "23000", priceCurrency: "KRW", availability: "InStock" }],
      },
    ])
  );
  assert.ok(p);
  assert.equal(p!.price, 23000);
  assert.equal(p!.inStock, true);
}

// ── 쓸 수 없는 입력은 null ──
{
  assert.equal(parseMallProductJsonLd(""), null);
  assert.equal(parseMallProductJsonLd("<html><body>제품</body></html>"), null);
  // 깨진 JSON 이 있어도 죽지 않는다
  assert.equal(parseMallProductJsonLd('<script type="application/ld+json">{ 깨짐 </script>'), null);
  // 가격이 없거나 0 이면 오퍼로 쓸 수 없다
  assert.equal(parseMallProductJsonLd(ld({ "@type": "Product", name: "X", offers: { price: "0" } })), null);
  assert.equal(parseMallProductJsonLd(ld({ "@type": "Product", name: "X" })), null);
  // 이름이 비면 대조할 수 없다
  assert.equal(parseMallProductJsonLd(ld({ "@type": "Product", name: "", offers: { price: "1" } })), null);
}

// ── 자리표시 가격 몰은 통째로 버린다 (라네즈 실측) ──
{
  const mk = (price: number): MallProduct => ({ name: "x", price, currency: "KRW", inStock: true });

  // 라네즈: 전부 100원
  assert.equal(
    mallPricesLookLikePlaceholders([mk(100), mk(100), mk(100), mk(100), mk(100), mk(100)]),
    true,
    "«립 슬리핑 마스크 100원» 이 화면에 나가면 안 된다"
  );

  // 정상 몰: 실제 소매가
  assert.equal(
    mallPricesLookLikePlaceholders([mk(23000), mk(15725), mk(11900), mk(28000), mk(39000), mk(4000)]),
    false
  );

  // 절반 이하가 싸면 몰 전체를 버리지 않는다 — 진짜 저가 상품(샘플·파우치)이 섞일 수 있다.
  assert.equal(
    mallPricesLookLikePlaceholders([mk(100), mk(500), mk(23000), mk(15000), mk(28000), mk(39000)]),
    false
  );

  // 표본이 적으면 판단하지 않는다
  assert.equal(mallPricesLookLikePlaceholders([mk(100), mk(100)]), false);
  assert.equal(mallPricesLookLikePlaceholders([]), false);

  // KRW 가 아닌 것은 이 판단에서 뺀다
  const usd = (price: number): MallProduct => ({ name: "x", price, currency: "USD", inStock: true });
  assert.equal(mallPricesLookLikePlaceholders([usd(9), usd(12), usd(8), usd(20), usd(15), usd(11)]), false);
}

assert.equal(MIN_PLAUSIBLE_KRW, 1000);

console.log("mall-product-data self-test: ok");

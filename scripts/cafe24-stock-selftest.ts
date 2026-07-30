/**
 * Cafe24 품절 신호 판독 + 자리표시 가격 가드 회귀 고정.
 *
 * 아래 마크업은 2026-07-27 lador.co.kr 에서 판매중 상품과 품절 상품을 직접
 * 받아 비교한 실물이다. Cafe24 는 품절 배지를 **항상 넣어두고** `displaynone`
 * 으로 감추므로, «sold out» 이라는 낱말만 보고 판단하면 판매중인 상품이
 * 통째로 품절 처리된다.
 */
import assert from "node:assert/strict";
import {
  parseCafe24StockSignal,
  parseStockStatus,
} from "../src/lib/pipeline/offers/offer-stock";
import { isImplausibleRetailPrice } from "../src/lib/pipeline/offers/offer-price";
import { evaluateOfferVerificationGate } from "../src/lib/pipeline/offers/offer-gate";

// --- 실물 마크업 --------------------------------------------------------

/** lador.co.kr id 414 «루트 리부트 맞춤 탈모 샴푸 350ml» — 판매중 */
const IN_STOCK_HTML =
  '<div class="action_button">' +
  '<span class="button buy"><span id="btnBuy">Buy Now</span></span>' +
  '<span class="button sold-out displaynone">Soldout</span>' +
  '<span class="button sms-restock displaynone" id="btn_restock">재입고알림</span>' +
  "</div>";

/** lador.co.kr id 104 «데미지 프로텍터 산성 샴푸 150ml» — 품절 */
const SOLD_OUT_HTML =
  '<div class="action_button">' +
  '<span class="button buy displaynone"><span id="btnBuy">Buy Now</span></span>' +
  '<span class="button sold-out">Soldout</span>' +
  '<span class="button sms-restock" id="btn_restock">재입고알림</span>' +
  "</div>";

// --- 구조 판독 -----------------------------------------------------------

assert.equal(parseCafe24StockSignal(IN_STOCK_HTML)?.stockStatus, "in_stock");
assert.equal(
  parseCafe24StockSignal(IN_STOCK_HTML)?.reasons[0],
  "cafe24_soldout_badge_hidden"
);
assert.equal(parseCafe24StockSignal(SOLD_OUT_HTML)?.stockStatus, "out_of_stock");

// Cafe24 가 아닌 페이지에는 아무 말도 하지 않는다.
assert.equal(parseCafe24StockSignal("<html><body>그냥 페이지</body></html>"), null);
assert.equal(parseCafe24StockSignal(""), null);
assert.equal(parseCafe24StockSignal(null), null);

// --- 낱말 검사보다 먼저 와야 한다 ----------------------------------------

{
  // 숨겨진 «Soldout» 낱말 때문에 판매중 상품이 품절로 뒤집히면 안 된다.
  const r = parseStockStatus({ pageHtml: IN_STOCK_HTML, pageText: IN_STOCK_HTML });
  assert.equal(r.stockStatus, "in_stock", "숨겨진 품절 배지에 속으면 안 된다");
  assert.ok(r.confidence >= 0.7, "게이트의 stockConfidence 문턱을 넘어야 쓸모가 있다");
}
{
  const r = parseStockStatus({ pageHtml: SOLD_OUT_HTML, pageText: SOLD_OUT_HTML });
  assert.equal(r.stockStatus, "out_of_stock");
}
{
  // HTML 이 없으면 종전대로 동작한다. 버튼만으로는 재고를 단정하지 않는다.
  const r = parseStockStatus({ buttonText: "장바구니" });
  assert.equal(r.stockStatus, "unknown");
  assert.equal(r.reasons.includes("button_only_insufficient"), true);
}
{
  // 스키마가 명시하면 그대로 따른다.
  const r = parseStockStatus({ availability: "https://schema.org/InStock" });
  assert.equal(r.stockStatus, "in_stock");
}

// --- 자리표시 가격 -------------------------------------------------------

assert.equal(isImplausibleRetailPrice(100, "KRW"), true, "100원은 소매가가 아니다");
assert.equal(isImplausibleRetailPrice(999, "KRW"), true);
assert.equal(isImplausibleRetailPrice(1000, "KRW"), false);
assert.equal(isImplausibleRetailPrice(19500, "KRW"), false);
assert.equal(isImplausibleRetailPrice(22, "USD"), false);
assert.equal(isImplausibleRetailPrice(null, "KRW"), false);

// --- 게이트 통합 ---------------------------------------------------------

const baseInput = {
  grade: "official_brand_store" as const,
  identity: "strong_match" as const,
  identityConfidence: 0.9,
  purchaseUrl: "https://lador.co.kr/product/x/1/category/24/display/1/",
  currency: "KRW" as const,
  stockStatus: "in_stock" as const,
  stockConfidence: 0.8,
  shipsToCountries: ["KR"],
  shippingConfidence: 0.8,
  officialConfidenceThreshold: 0.7,
};

{
  // 재고가 읽히고 가격이 정상이면 통과한다 — 이번 작업으로 열린 경로.
  const r = evaluateOfferVerificationGate({ ...baseInput, price: 19500 });
  assert.equal(
    r.blockers.includes("not_in_stock"),
    false,
    "Cafe24 재고 판독이 not_in_stock 을 풀어야 한다"
  );
  assert.equal(r.blockers.includes("price_implausible_placeholder"), false);
}
{
  // 재고가 읽혀도 100원짜리는 자동 검증되지 않는다. 이 가드가 없으면
  // 브랜드 소개몰의 자리표시 가격이 그대로 사용자에게 노출된다.
  const r = evaluateOfferVerificationGate({ ...baseInput, price: 100 });
  assert.equal(
    r.blockers.includes("price_implausible_placeholder"),
    true,
    "100원 자리표시는 막혀야 한다"
  );
  assert.equal(r.passVerified, false);
}

console.log("cafe24 stock + placeholder price selftest: ok");

// --- 부모가 감추는 테마 (2026-07-27 abib.co.kr 실물) --------------------

/**
 * abib 은 품절 배지를 감출 때 `displaynone` 을 **부모 div** 에 붙인다.
 * 요소의 class 만 보면 판매중인 상품이 전부 품절로 뒤집힌다 —
 * 실제로 그렇게 10건을 잘못 기록했다.
 */
const ABIB_IN_STOCK =
  '<div class=" "><a href="#none" onclick="product_submit(1, \'/exec/front/order/basket/\', this)">' +
  '<input type="button" class="btn buy-btn" value="구매하기"></a></div>' +
  '<div class="displaynone"><span class="mar10 btn sold-out">SOLDOUT</span></div>';

const ABIB_SOLD_OUT =
  '<div class="displaynone"><a href="#none"><input type="button" class="btn buy-btn" value="구매하기"></a></div>' +
  '<div class=" "><span class="mar10 btn sold-out">SOLDOUT</span></div>';

assert.equal(
  parseCafe24StockSignal(ABIB_IN_STOCK)?.stockStatus,
  "in_stock",
  "부모가 감춘 품절 배지는 품절이 아니다"
);
assert.equal(parseCafe24StockSignal(ABIB_SOLD_OUT)?.stockStatus, "out_of_stock");

// 부모 div 가 요소 앞에서 이미 닫혔으면 그 div 는 부모가 아니다.
assert.equal(
  parseCafe24StockSignal(
    '<div class="displaynone">다른 내용</div><span class="btn sold-out">SOLDOUT</span>'
  )?.stockStatus,
  "out_of_stock",
  "닫힌 div 를 부모로 오인하면 안 된다"
);

// 기존 lador 형태(요소 자체에 displaynone)는 그대로 동작한다.
assert.equal(parseCafe24StockSignal(IN_STOCK_HTML)?.stockStatus, "in_stock");
assert.equal(parseCafe24StockSignal(SOLD_OUT_HTML)?.stockStatus, "out_of_stock");

console.log("cafe24 ancestor-hidden selftest: ok");

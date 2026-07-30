/**
 * 봇 챌린지 페이지 판정 회귀 고정.
 *
 * Shopify 는 모든 스토어 페이지에 `captcha-bootstrap` 스크립트를 심는다.
 * 낱말 `captcha` 하나로 거부하면 정상 제품 페이지가 통째로 막힌다.
 * 반대로 진짜 챌린지 페이지는 계속 거부해야 한다 — 우회는 하지 않는다.
 */
import assert from "node:assert/strict";
import { looksLikeChallengePage } from "../src/lib/catalog/officialCrawl";

// --- 거부해야 하는 것 (진짜 챌린지) --------------------------------------

assert.equal(
  looksLikeChallengePage(
    "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>"
  ),
  true,
  "Cloudflare 대기 페이지는 거부"
);
assert.equal(
  looksLikeChallengePage("<html><body>Attention Required! | Cloudflare</body></html>"),
  true
);
assert.equal(
  looksLikeChallengePage("<html><body><div id='cf-challenge-running'></div></body></html>"),
  true
);
assert.equal(
  looksLikeChallengePage("<html><head><title>Captcha Verification</title></head></html>"),
  true
);
assert.equal(
  looksLikeChallengePage(
    "<html><body>Please complete the captcha to continue.</body></html>"
  ),
  true,
  "상품 데이터 없는 작은 captcha 페이지는 거부"
);

// --- 통과시켜야 하는 것 (정상 상품 페이지) -------------------------------

const shopifyProductPage =
  "<html><head>" +
  '<script id="captcha-bootstrap">!function(){/* shopify spam protection */}()</script>' +
  '<script type="application/ld+json">{"@type":"Product","name":"Pine Calming Cica Shampoo",' +
  '"offers":{"@type":"Offer","price":"18000","priceCurrency":"KRW"}}</script>' +
  "</head><body>" +
  "x".repeat(60_000) +
  "recaptcha-v3-token g-recaptcha-response" +
  "</body></html>";

assert.equal(
  looksLikeChallengePage(shopifyProductPage),
  false,
  "captcha-bootstrap 이 있어도 JSON-LD Product 가 있으면 통과"
);

assert.equal(
  looksLikeChallengePage(
    '<html><head><meta property="og:type" content="product"><title>Just a moment</title></head>' +
      "<body>captcha</body></html>"
  ),
  false,
  "og:type=product 도 상품 신호로 인정"
);

assert.equal(looksLikeChallengePage("<html><body>정상 페이지</body></html>"), false);
assert.equal(looksLikeChallengePage(""), false);

console.log("challenge detection selftest: ok");

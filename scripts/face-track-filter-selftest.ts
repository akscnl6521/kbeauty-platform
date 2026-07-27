/**
 * 얼굴 추천 후보 풀에서 얼굴 트랙 밖 제품을 빼는 규칙 검증.
 *
 * 브랜드 자사몰을 통째로 수집하면 향수·핸드크림·바디워시가 같이 들어와,
 * 얼굴 고민(홍조·모공·주름) 시나리오의 추천 후보로 잡힌다. §29 MVP 는 얼굴
 * 트랙만이고 §44 단계 6.5(트랙 B)는 미착수다.
 *
 * 제품을 내리는 게 아니라 **얼굴 추천 풀에서만** 빼는 것이라, 카탈로그 자체의
 * 노이즈 필터(`isExcludedFromPublicCatalog`)와 별개로 둔다.
 *
 * 실행: npm run test:face-track-filter
 */
import assert from "node:assert/strict";
import {
  isOutsideFaceTrack,
  isExcludedFromPublicCatalog,
} from "../src/lib/recommend/publicCatalogFilter";

// ── 얼굴 트랙 밖 — 빠져야 한다
for (const category of [
  "perfume",
  "hand_cream",
  "body_lotion",
  "body_wash",
  "body_oil",
  "body_scrub",
  "foot_cream",
]) {
  assert.equal(isOutsideFaceTrack({ category }), true, `${category} 가 안 빠진다`);
}

// 대소문자·앞뒤 공백이 있어도 같게 본다 (수집기가 넣는 값이 항상 정규형은 아니다)
assert.equal(isOutsideFaceTrack({ category: "  PERFUME " }), true);
assert.equal(isOutsideFaceTrack({ category: "Hand_Cream" }), true);

// ── 얼굴 제품 — 남아야 한다
for (const category of [
  "serum",
  "cream",
  "toner",
  "essence",
  "ampoule",
  "mask",
  "eye_patch",
  "sunscreen",
  "cleanser",
  "foam_cleanser",
  "cleansing_balm",
  "moisturizer",
]) {
  assert.equal(isOutsideFaceTrack({ category }), false, `${category} 가 잘못 빠진다`);
}

// ── 카테고리를 모르면 빼지 않는다
// 유형을 모른다는 이유로 얼굴 제품을 조용히 떨어뜨리는 쪽이 더 나쁘다.
assert.equal(isOutsideFaceTrack({ category: null }), false);
assert.equal(isOutsideFaceTrack({ category: "" }), false);
assert.equal(isOutsideFaceTrack({ category: "   " }), false);
assert.equal(isOutsideFaceTrack({}), false);

// ── 두 필터는 서로 다른 일을 한다
{
  // 향수는 «테스트·probe 노이즈» 가 아니다 — 진짜 제품이라 카탈로그에는 남는다.
  const perfume = { name: "오 드 퍼퓸 타입 N", slug: "abib-eau-de-parfum-n", category: "perfume" };
  assert.equal(isExcludedFromPublicCatalog(perfume), false, "향수가 카탈로그에서까지 빠졌다");
  assert.equal(isOutsideFaceTrack(perfume), true);

  // 반대로 probe 제품은 카테고리와 무관하게 노이즈 필터가 잡는다.
  const probe = { name: "HTTP API 권한 검증용", slug: "probe-http-api", category: "serum" };
  assert.equal(isExcludedFromPublicCatalog(probe), true);
  assert.equal(isOutsideFaceTrack(probe), false);
}

// ── 헤어·두피 제품은 여기서 빼지 않는다
// 단계 5.5 두피·모발 트랙은 별도 점수 체계를 쓰기로 돼 있어(§44), 이 필터가
// 미리 손대면 그 트랙 설계와 충돌한다. 지금은 건드리지 않는 게 맞다.
for (const category of ["shampoo", "conditioner", "hair_treatment", "hair_styling"]) {
  assert.equal(isOutsideFaceTrack({ category }), false, `${category} 를 이 필터가 건드렸다`);
}

console.log("face-track-filter self-test: ok");

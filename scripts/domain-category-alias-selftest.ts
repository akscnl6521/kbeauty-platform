/**
 * 카테고리 → 뷰티 도메인 매핑 회귀 고정 (§44 단계 5.5 · 6.5).
 *
 * 정규 카테고리는 세분화돼 있지만 크롤·기존 DB 는 평문을 쓴다. 평문이
 * `other` 로 떨어지면 도메인 필터에서 사라져, 제품을 등록해도 추천에 뜨지
 * 않는다. 여기서 실제로 유입되는 문자열을 고정한다.
 */
import assert from "node:assert/strict";
import { beautyDomainForCategory } from "../src/lib/catalog/taxonomy/domains";

const cases: Array<[string, string]> = [
  // 정규 카테고리 (기존 동작 유지)
  ["scalp_tonic", "scalp_care"],
  ["scalp_scaler", "scalp_care"],
  ["conditioner", "hair_care"],
  ["hair_oil", "hair_care"],
  ["body_wash", "body_care"],
  ["body_lotion", "body_care"],
  ["hand_cream", "hand_foot_care"],
  ["foot_cream", "hand_foot_care"],
  ["perfume", "fragrance"],
  ["led_mask", "beauty_devices"],

  // 얼굴 (회귀 방지)
  ["toner", "face_skincare"],
  ["serum", "face_skincare"],
  ["moisturizer", "face_skincare"],
  ["sunscreen", "sun_care"],

  // 단계 5.5·6.5 유입 평문 — 이전에는 전부 other 로 떨어졌다
  ["shampoo", "hair_care"],
  ["hair_treatment", "hair_care"],
  ["hair_essence", "hair_care"],
  ["hair_pack", "hair_care"],
  ["hair_gel", "hair_care"],
  ["scalp_care", "scalp_care"],
  ["hair_tonic", "scalp_care"],
  ["body", "body_care"],
  ["shower_gel", "body_care"],
  ["hand_care", "hand_foot_care"],

  // 기존 DB 에 실제로 존재하는 공백·슬래시 표기
  ["lip care", "lip_care"],
  ["makeup/base", "base_makeup"],

  // 대소문자·공백 정규화
  ["  SHAMPOO  ", "hair_care"],
  ["Body_Wash", "body_care"],
];

for (const [category, expected] of cases) {
  const actual = beautyDomainForCategory(category);
  assert.equal(
    actual,
    expected,
    `"${category}" 는 ${expected} 여야 하는데 ${actual} 로 분류됨`
  );
}

// 알 수 없는 값은 여전히 other 로 남는다 — 임의 추측 금지
assert.equal(beautyDomainForCategory("완전히_모르는_카테고리"), "other");
assert.equal(beautyDomainForCategory(""), "other");
assert.equal(beautyDomainForCategory(null), "other");
assert.equal(beautyDomainForCategory(undefined), "other");

console.log(`domain category alias selftest: ok (${cases.length} mappings)`);

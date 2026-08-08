/**
 * `src/lib/catalog/taxonomy/canonicalProductCategory.ts` 회귀 테스트.
 *
 * 값은 전부 2026-08-09 Production 추천 풀에서 실제로 관측된 것이다.
 *
 * 실행: npx tsx scripts/canonical-product-category-selftest.ts
 */
import assert from "node:assert/strict";
import {
  canonicalProductCategory,
  isCanonicalProductCategory,
  refineCategoryFromName,
} from "../src/lib/catalog/taxonomy/canonicalProductCategory";

function main() {
  // 표기만 다른 것들 — 대소문자·공백·하이픈
  const same: Array<[string, string]> = [
    ["Serum", "serum"],
    ["serum", "serum"],
    ["Toner", "toner"],
    ["Cream", "cream"],
    ["Ampoule", "ampoule"],
    ["Essence", "essence"],
    ["Eye Cream", "eye_cream"],
    ["eye-cream", "eye_cream"],
    ["EYE CREAM", "eye_cream"],
    ["cleansing_oil", "cleansing_oil"],
    ["foam_cleanser", "foam_cleanser"],
    ["lotion", "lotion"],
  ];
  for (const [input, want] of same) {
    assert.equal(canonicalProductCategory(input), want, `«${input}» 을 «${want}» 로 못 바꿨다`);
  }

  // 뜻이 확실한 별칭
  const aliases: Array<[string, string]> = [
    ["Moisturizer", "cream"],
    ["SPF", "sunscreen"],
    ["mist", "facial_mist"],
    ["facial_oil", "face_oil"],
  ];
  for (const [input, want] of aliases) {
    assert.equal(canonicalProductCategory(input), want, `«${input}» → «${want}» 실패`);
  }

  // **모르면 null 이어야 한다.** 억지로 끼워 맞추면 틀렸다는 것조차 드러나지 않는다.
  //
  //   `mask`     어느 마스크인지(시트·수면·워시오프) 이름만으로는 모른다
  //   `cleanser` 어느 클렌저인지 모른다
  //   `balm`     클렌징 밤인지 립 밤인지 모른다
  for (const unknown of ["mask", "Mask", "cleanser", "balm", "", "  ", "아무거나"]) {
    assert.equal(canonicalProductCategory(unknown), null, `«${unknown}» 을 억지로 바꿨다`);
  }
  assert.equal(canonicalProductCategory(null), null);
  assert.equal(canonicalProductCategory(undefined), null);

  // 이미 표준인지 판별
  assert.ok(isCanonicalProductCategory("serum"));
  assert.ok(isCanonicalProductCategory("sunscreen"));
  assert.equal(isCanonicalProductCategory("Serum"), false);
  assert.equal(isCanonicalProductCategory("mask"), false);
  assert.equal(isCanonicalProductCategory(null), false);

  
  // ── 덩어리 유형은 «이름이 말해 줄 때만» 좁힌다 ──
  const refine: Array<[string, string, string]> = [
    ["mask", "약산성 시트 마스크 아쿠아 핏", "sheet_mask"],
    ["mask", "화이트 트러플 슬리핑 마스크", "sleeping_mask"],
    ["mask", "화이트 트러플 클리닉 모델링 마스크 [영양/보습]", "modeling_mask"],
    ["mask", "달바 시그니처 비타 캡슐 콜라겐 하이드로겔 마스크", "hydrogel_mask"],
    ["cleanser", "캐로틴 아크네 폼클렌저", "foam_cleanser"],
    ["cleanser", "화이트 트러플 퓨리파잉 젤 클렌저", "gel_cleanser"],
    ["balm", "시그니처 비타 콜라겐 딥 클렌징 밤", "cleansing_balm"],
  ];
  for (const [cat, name, want] of refine) {
    assert.equal(refineCategoryFromName(cat, name), want, `«${name}» → «${want}» 실패`);
  }

  // **이름이 말해 주지 않으면 null.** 덩어리 값을 그대로 둔다.
  assert.equal(refineCategoryFromName("mask", "찹쌀 쫀쫀팩 60g"), null);
  // `오일 크림 클렌저` 는 클렌징 오일인지 밀크인지 이름만으로 단정할 수 없다.
  // `밀크 팩 클렌저` 도 마찬가지다. **애매하면 null** 이 맞다 — 하나로 정해
  // 버리면 틀렸다는 것조차 드러나지 않는다.
  assert.equal(refineCategoryFromName("cleanser", "화이트 트러플 리턴 오일 크림 클렌저"), null);
  assert.equal(refineCategoryFromName("cleanser", "밀크 팩 클렌저"), null);
  assert.equal(refineCategoryFromName("cleanser", "데일리 젠틀 클렌저"), null);
  // 이미 표준인 값은 건드리지 않는다.
  assert.equal(refineCategoryFromName("serum", "무엇이든"), null);

  console.log("canonical-product-category self-test: ok");
}

main();

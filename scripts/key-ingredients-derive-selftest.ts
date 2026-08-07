/**
 * `deriveKeyIngredientsFromFullList` 자체 검증.
 *
 * 이 함수는 추천 파이프라인이 실제로 읽는 유일한 성분 필드(`key_ingredients`)를
 * 만든다. 여기서 없는 이름이 새어 들어가면 «지어낸 성분»이 추천 근거로 표시되므로,
 * 반환값이 항상 입력 전성분의 부분집합인지 먼저 확인한다.
 *
 * 실행: npx --yes tsx scripts/key-ingredients-derive-selftest.ts
 */
import assert from "node:assert/strict";
import { deriveKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients";

// 1. 반환 토큰은 반드시 입력 전성분에 있던 원문 그대로여야 한다.
{
  const full = [
    "Water",
    "Glycerin",
    "Niacinamide",
    "Butylene Glycol",
    "Sodium Hyaluronate",
    "Panthenol",
    "1,2-Hexanediol",
  ];
  const derived = deriveKeyIngredientsFromFullList(full);
  for (const d of derived) {
    assert.ok(full.includes(d), `전성분에 없는 토큰이 나왔다: ${d}`);
  }
  assert.ok(derived.includes("Niacinamide"));
  assert.ok(derived.includes("Panthenol"));
  assert.ok(derived.includes("Sodium Hyaluronate"));
  // 사전에 없는 흔한 용매는 골라내지 않는다.
  assert.ok(!derived.includes("Butylene Glycol"));
}

// 2. 대문자 표기(abib 전성분에서 실제로 나오는 형태)도 인식하되 원문을 유지한다.
{
  const full = ["AQUA", "PANTHENOL", "SQUALANE", "CERAMIDE NP", "CHOLESTEROL"];
  const derived = deriveKeyIngredientsFromFullList(full);
  assert.ok(derived.includes("PANTHENOL"), "대문자 표기를 놓쳤다");
  assert.ok(derived.includes("CERAMIDE NP"));
  // 소문자로 정규화해서 저장하면 안 된다 — 원문 대조가 깨진다.
  assert.ok(!derived.includes("panthenol"));
}

// 3. 한글 전성분만 있는 제품은 (영문 사전이므로) 억지로 채우지 않는다.
{
  const full = ["정제수", "글리세린", "부틸렌글라이콜", "향료"];
  const derived = deriveKeyIngredientsFromFullList(full);
  for (const d of derived) assert.ok(full.includes(d));
}

// 4. 빈 입력·공백 토큰에서 빈 문자열이 새지 않는다.
{
  assert.deepEqual(deriveKeyIngredientsFromFullList([]), []);
  assert.deepEqual(deriveKeyIngredientsFromFullList(["", "   "]), []);
}

// 5. 같은 성분이 두 번 적혀 있어도 중복으로 담지 않는다.
{
  const derived = deriveKeyIngredientsFromFullList([
    "Water",
    "Niacinamide",
    "Glycerin",
    "Niacinamide",
  ]);
  assert.equal(new Set(derived).size, derived.length, "중복 토큰이 담겼다");
}

// 6. 전성분에 적힌 순서를 유지한다 (앞에 적힌 성분이 함량이 높다는 관행).
{
  const derived = deriveKeyIngredientsFromFullList([
    "Water",
    "Glycerin",
    "Panthenol",
    "Niacinamide",
  ]);
  assert.deepEqual(derived, ["Glycerin", "Panthenol", "Niacinamide"]);
}



// ── 한글 전성분에서도 주요 성분을 뽑는다 (2026-08-05 국내몰 등록) ──
{
  // 영문 키만 있으면 한 개도 못 뽑고, 그러면 안전 필터가 추천 자격을 안 준다.
  const ko = deriveKeyIngredientsFromFullList([
    "정제수",
    "글리세린",
    "부틸렌글라이콜",
    "나이아신아마이드",
    "판테놀",
    "알란토인",
    "병풀추출물",
    "소듐하이알루로네이트",
    "아데노신",
    "토코페롤",
  ]);
  assert.ok(ko.length >= 5, `한글 목록에서 주요 성분을 뽑아야 한다: ${JSON.stringify(ko)}`);
  // 반환값은 사전 표시명이 아니라 **전성분에 적힌 원문 토큰**이어야 한다.
  assert.ok(ko.includes("나이아신아마이드"), "원문 한글 토큰을 그대로 돌려줘야 한다");
  assert.ok(ko.includes("병풀추출물"));
  assert.ok(!ko.includes("Niacinamide"), "제품이 선언하지 않은 이름이 들어가면 안 된다");
}

// ── 영문 목록은 그대로 동작한다 (한글 추가로 깨지지 않았는지) ──
{
  const en = deriveKeyIngredientsFromFullList([
    "Water",
    "Glycerin",
    "Niacinamide",
    "Panthenol",
    "Centella Asiatica Extract",
    "Sodium Hyaluronate",
  ]);
  assert.ok(en.includes("Niacinamide"));
  assert.ok(en.includes("Centella Asiatica Extract"));
  assert.ok(!en.includes("나이아신아마이드"));
}

console.log("key-ingredients-derive self-test: ok");

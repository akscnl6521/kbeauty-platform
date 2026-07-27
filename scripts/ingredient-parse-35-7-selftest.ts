/**
 * MASTER_PLAN §35.7 «전성분 처리 규칙» 회귀 고정.
 *
 * 2026-07-27 확인: 아래 규칙 네 가지가 파서에 구현돼 있지 않아, 성분이
 * 사라지는 정도가 아니라 **다른 성분으로 바뀌고 있었다.**
 *
 *   1,2-헥산다이올                    -> 2 헥산다이올        (다른 물질)
 *   N,N-다이메틸아세트아마이드          -> n 다이메틸...       (다른 물질)
 *   카프릴릭/카프릭트라이글리세라이드     -> 두 조각
 *   알라닌/히스티딘/라이신폴리펩타이드... -> 세 조각 (제품에 없는 알라닌이 매칭됨)
 *
 * 마지막 것이 특히 위험하다. 그 제품에 알라닌은 들어 있지 않은데 추천 엔진은
 * 들어 있다고 믿었다. 성분은 안전 판정의 근거이므로 그냥 «덜 매칭됨» 이 아니다.
 */
import assert from "node:assert/strict";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize";

const keys = (raw: string): string[] =>
  parseIngredientList(raw).normalized.map((x) => x.normalizedName);

// --- §35.7 화학명 내부 쉼표를 보호한다 --------------------------------

assert.deepEqual(keys("1,2-헥산다이올"), ["1,2 헥산다이올"], "1,2- 접두가 잘리면 안 된다");
assert.deepEqual(keys("N,N-다이메틸아세트아마이드"), ["n,n 다이메틸아세트아마이드"]);
assert.deepEqual(keys("2,4,5-트라이메틸아닐린"), ["2,4,5 트라이메틸아닐린"], "쉼표가 둘이어도 보호된다");

// 목록 구분자는 그대로 잘라야 한다 — 보호가 과하면 성분이 뭉친다.
assert.deepEqual(keys("정제수, 1,2-헥산다이올, 글리세린"), [
  "정제수",
  "1,2 헥산다이올",
  "글리세린",
]);
assert.deepEqual(keys("피이지-40, 2-헥산다이올"), ["피이지 40", "2 헥산다이올"], "쉼표 뒤 공백은 구분자다");

// --- §35.7 괄호 안 쉼표를 보호한다 ------------------------------------

assert.deepEqual(keys("나이아신아마이드(50,000 ppm)"), ["나이아신아마이드"], "농도 표기는 제거된다");
assert.deepEqual(keys("판테놀(750 ppm)"), ["판테놀"]);

// 괄호 안 숫자를 무조건 지우면 안 된다 — 색소는 번호가 이름의 일부다.
assert.deepEqual(keys("적색104호의(1)"), ["적색104호의(1)"], "색소 번호는 이름이다");

// --- §35.7 성분 내부 슬래시를 임의 분리하지 않는다 ---------------------

assert.deepEqual(keys("카프릴릭/카프릭트라이글리세라이드"), ["카프릴릭 카프릭트라이글리세라이드"]);
assert.deepEqual(keys("알라닌/히스티딘/라이신폴리펩타이드카퍼에이치씨엘"), [
  "알라닌 히스티딘 라이신폴리펩타이드카퍼에이치씨엘",
]);
assert.deepEqual(keys("PEG/PPG-17/6 Copolymer"), ["peg ppg 17 6 copolymer"]);

// 세미콜론과 파이프는 여전히 구분자다.
assert.deepEqual(keys("정제수; 글리세린 | 부틸렌글라이콜"), ["정제수", "글리세린", "부틸렌글라이콜"]);

// --- §35.7 모지베이크를 자동 탐지한다 ---------------------------------

assert.deepEqual(keys("정제수, ����, 글리세린"), ["정제수", "글리세린"]);

// --- 크롤이 함께 담아 온 문구 -----------------------------------------

assert.deepEqual(keys("Open / Close 정제수, 글리세린"), ["정제수", "글리세린"]);
assert.deepEqual(
  keys("정제수, 토코페롤 사용상의 주의사항 이 제품은..."),
  ["정제수", "토코페롤"],
  "주의사항부터는 성분이 아니다"
);
assert.deepEqual(keys("제1제 : 정제수, 글리세린"), ["정제수", "글리세린"]);

// --- 기존 동작이 유지되는지 -------------------------------------------

assert.deepEqual(keys("Water, Glycerin, Butylene Glycol"), ["water", "glycerin", "butylene glycol"]);
assert.deepEqual(keys("Aqua"), ["water"], "aqua -> water 정규화 유지");
assert.deepEqual(keys("CI 77891"), ["ci 77891"]);
assert.deepEqual(keys(""), []);
assert.deepEqual(keys(null), []);

console.log("ingredient parse §35.7 selftest: ok");

// --- 꼬리 문구 규칙 (2026-07-27 추가) ---------------------------------

// 저장된 전성분이 «사용상의» 에서 잘려 있다. 뒤에 «주의사항» 이 없어도 끝이다.
assert.deepEqual(keys("정제수, 생강추출물 사용상의"), ["정제수", "생강추출물"]);
assert.deepEqual(keys("정제수, 토코페롤 사용상의 주의사항 이 제품은..."), ["정제수", "토코페롤"]);

// `!---!` 는 구분 마커다. 성분명 앞에 눌어붙으면 안 된다.
assert.deepEqual(keys("에틸헥실글리세린!---!다이아이소스테아릴말레이트"), [
  "에틸헥실글리세린",
  "다이아이소스테아릴말레이트",
]);

// «(N번)» 은 구획 경계다. 공백이 아니라 쉼표로 끊어야 앞뒤가 안 붙는다.
assert.deepEqual(keys("(1번) 정제수, 글리세린 (3번) 정제수, 판테놀"), [
  "정제수",
  "글리세린",
  "판테놀",
]);
assert.deepEqual(keys("로즈마리잎오일 (3번) 정제수"), ["로즈마리잎오일", "정제수"]);

console.log("ingredient parse tail-rule selftest: ok");

// --- 변형 제품 구획 라벨 (2026-07-27 추가) -----------------------------

// 목록 뒤 고지 문구. 앞의 `*` 가 지워져 마지막 성분에 눌어붙는다.
assert.deepEqual(
  keys("정제수, 카르노신 * 전성분은 제조 시기에 따라 변경될 수 있습니다."),
  ["정제수", "카르노신"]
);

// 세트 구성품 라벨 — 콜론은 INCI 이름에 쓰이지 않는다.
assert.deepEqual(keys("원더밤: 정제수, 글리세린"), ["정제수", "글리세린"]);
assert.deepEqual(keys("향료 원더티어 : 정제수, 판테놀"), ["향료", "정제수", "판테놀"]);

// 번호 붙은 변형 라벨.
assert.deepEqual(keys("1. 어웨이크닝 - 정제수, 멘톨"), ["정제수", "멘톨"]);
assert.deepEqual(keys("향료 2. 퓨리파잉 - 정제수, 글리세린"), ["향료", "정제수", "글리세린"]);

// 라벨 규칙이 성분명을 삼키면 안 된다.
assert.deepEqual(keys("정제수, 부틸렌글라이콜, 글리세린"), [
  "정제수",
  "부틸렌글라이콜",
  "글리세린",
]);
assert.deepEqual(keys("1,2-헥산다이올, 판테놀"), ["1,2 헥산다이올", "판테놀"]);

console.log("ingredient parse variant-label selftest: ok");

// 대괄호 구획 라벨도 경계다. 지우기만 하면 앞뒤 성분이 붙는다.
assert.deepEqual(keys("향료, 황색4호 [컨디셔너] 정제수, 글리세린"), [
  "향료",
  "황색4호",
  "정제수",
  "글리세린",
]);

console.log("ingredient parse bracket-label selftest: ok");

// --- 길이 한도에서 잘린 꼬리 조각 (2026-07-27 추가) --------------------

import { attachIngredientMatches, buildIngredientLookupMaps } from "../src/lib/pipeline/ingredient-normalize";

{
  // 사전에 온전한 이름만 있고, 목록 끝에는 잘린 조각이 남은 상황.
  const maps = buildIngredientLookupMaps([
    { id: 1, name_ko: "정제수" },
    { id: 2, name_ko: "카프릴릭/카프릭트라이글리세라이드" },
  ]);
  const parsed = parseIngredientList(
    "정제수, 카프릴릭/카프릭트라이글리세라이드, 정제수, 카프릴릭/카프릭트라이글리세"
  );
  const out = attachIngredientMatches(parsed, maps).normalized;
  assert.equal(out.length, 2, "잘린 꼬리 조각은 성분으로 세지 않는다");
  assert.equal(out.filter((x) => !x.matchedIngredientId).length, 0);
}

{
  // 마지막 토큰이 사전에 있으면 접두사여도 지우지 않는다 — 진짜 성분이다.
  const maps = buildIngredientLookupMaps([
    { id: 1, name_ko: "레티놀팔미테이트" },
    { id: 2, name_ko: "레티놀" },
  ]);
  const out = attachIngredientMatches(
    parseIngredientList("레티놀팔미테이트, 레티놀"),
    maps
  ).normalized;
  assert.equal(out.length, 2, "매칭되는 성분은 접두사여도 남긴다");
  assert.equal(out[1]!.matchedIngredientId, 2);
}

{
  // 접두사가 아니면 그대로 둔다.
  const maps = buildIngredientLookupMaps([{ id: 1, name_ko: "정제수" }]);
  const out = attachIngredientMatches(parseIngredientList("정제수, 알수없는성분"), maps).normalized;
  assert.equal(out.length, 2);
}

console.log("ingredient truncated-tail selftest: ok");

// --- 반각 괄호·구획 라벨·결제 팝업 (2026-07-27 추가) -------------------

// 원문이 반각 괄호를 쓰면 전각 표식으로는 안 걸린다. NFKC 로 먼저 통일한다.
assert.deepEqual(
  keys("정제수, 토코페롤, 다이소듐이디티에이 . ｢화장품법｣에 따른 기능성 화장품(미백"),
  ["정제수", "토코페롤", "다이소듐이디티에이"]
);

// `제2제 :` 도 경계다. 공백으로 지우면 앞뒤가 붙는다.
assert.deepEqual(keys("다이소듐이디티에이 제2제 : 정제수, 세테아릴알코올"), [
  "다이소듐이디티에이",
  "정제수",
  "세테아릴알코올",
]);

// 쇼핑몰 결제 팝업 문구는 성분이 아니다.
assert.deepEqual(
  keys("정제수, 글리세린, 현재 결제가 진행중입니다. 본 결제 창은"),
  ["정제수", "글리세린"]
);

console.log("ingredient parse fullwidth/section selftest: ok");

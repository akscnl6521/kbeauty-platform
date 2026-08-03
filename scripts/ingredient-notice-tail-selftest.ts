/**
 * 성분 토큰에 딸려 붙은 **안내 문구 분리** 회귀 테스트.
 *
 * 표본은 2026-08-04 Staging 실측이다. 향료 알레르기를 신고해도 두 건이 안 걸렸는데,
 * `향료` 가 목록에 분명히 있는데도 안내 문구와 한 토큰으로 붙어 있어서였다.
 *
 * 이 분리가 과하면 **진짜 성분이 잘린다** — 그건 알레르겐을 놓치는 쪽이라 더 위험하다.
 * 그래서 «잘라야 하는 것» 만큼 «자르면 안 되는 것» 을 촘촘히 둔다.
 *
 * 실행: npm run test:ingredient-notice-tail
 */
import assert from "node:assert/strict";
import {
  coerceIngredientListUnknown,
  indexIngredients,
  stripIngredientNoticeTail,
  toCanonical,
} from "../src/lib/recommend/normalizeIngredient";
import { matchAllergenByCanonical } from "../src/lib/recommend/allergenMatch";

// ── 안내 문구는 잘라낸다 (실측) ──
assert.equal(
  stripIngredientNoticeTail("향료 기능성 화장품 식품의약품안전처 심사필 여부 해당사항 없음 사용할 때의"),
  "향료"
);
assert.equal(stripIngredientNoticeTail("정제수 사용 시 주의사항"), "정제수");
assert.equal(stripIngredientNoticeTail("글리세린 제조번호 및 사용기한 별도표기"), "글리세린");
assert.equal(stripIngredientNoticeTail("판테놀 내용량 50ml"), "판테놀");

// ── 진짜 성분은 절대 자르지 않는다 ──
for (const keep of [
  "향료",
  "정제수",
  "부틸렌글라이콜",
  "1,2-헥산다이올",
  "다이프로필렌글라이콜",
  "하이드록시에틸셀룰로오스",
  "소듐하이알루로네이트",
  "병풀추출물",
  "Water",
  "Butylene Glycol",
  "Sodium Hyaluronate",
  "Caprylic/Capric Triglyceride",
]) {
  assert.equal(stripIngredientNoticeTail(keep), keep, `«${keep}» 는 그대로 남아야 한다`);
}

// ── 호수별 목록은 끊지 말고 쪼갠다 ──
{
  // 끊어 버리면 5번 호수의 성분이 통째로 사라진다 — 알레르겐을 놓치는 쪽이다.
  const list = coerceIngredientListUnknown(["(1번) 정제수, 글리세린, 향료 (5번) 정제수, 판테놀, 리모넨"]);
  assert.ok(list.includes("향료"), `향료 가 있어야 한다: ${JSON.stringify(list)}`);
  assert.ok(list.includes("판테놀"), `뒤쪽 호수 성분도 남아야 한다: ${JSON.stringify(list)}`);
  assert.ok(list.includes("리모넨"), `뒤쪽 호수 알레르겐이 사라지면 안 된다: ${JSON.stringify(list)}`);
}

// ── 실측 두 건이 이제 걸리는가 (통합) ──
{
  const cases: Array<[string, string]> = [
    [
      "제품 60",
      "정제수, 미리스틱애씨드, 글리세린, 라우릭애씨드, 팔미틱애씨드, " +
        "향료 기능성 화장품 식품의약품안전처 심사필 여부 해당사항 없음 사용할 때의",
    ],
    [
      "제품 63",
      "(1번) 정제수, 1,2-헥산다이올, 부틸렌글라이콜, 글리세린, 감초뿌리추출물, " +
        "향료 (5번) 정제수, 병풀추출물",
    ],
  ];
  for (const [who, raw] of cases) {
    const idx = indexIngredients(coerceIngredientListUnknown([raw]));
    const hit = matchAllergenByCanonical(toCanonical("Fragrance"), idx);
    assert.ok(hit, `${who}: 향료 알레르기가 걸러져야 한다`);
  }
}

// ── 향료가 없는 목록을 잘못 잡으면 안 된다 ──
{
  const idx = indexIngredients(
    coerceIngredientListUnknown(["정제수, 글리세린, 부틸렌글라이콜, 판테놀, 알란토인"])
  );
  assert.equal(matchAllergenByCanonical(toCanonical("Fragrance"), idx), null, "없는 알레르겐을 잡으면 안 된다");
}

// ── 지방 알코올을 변성알코올로 오인하면 안 된다 (2026-07-27 회귀) ──
{
  const idx = indexIngredients(coerceIngredientListUnknown(["Water, Cetearyl Alcohol, Glycerin"]));
  assert.equal(
    matchAllergenByCanonical(toCanonical("Alcohol Denat"), idx),
    null,
    "Cetearyl Alcohol 은 변성알코올이 아니다"
  );
}

// ── 빈 입력 ──
assert.equal(stripIngredientNoticeTail(""), "");
assert.deepEqual(coerceIngredientListUnknown(null), []);

console.log("ingredient-notice-tail self-test: ok");

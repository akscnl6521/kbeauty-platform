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
import { splitIngredientTokens } from "../src/lib/catalog/validateIngredientList";
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

// ── LHA(살리실산 유도체)를 살리실산 회피에 묶는다 (2026-08-04 결정) ──
{
  // 살리실산을 피하는 사용자에게는 유도체도 피해야 할 것이다.
  // `Betaine Salicylate` 를 같은 그룹에 둔 기존 판단과 같은 결이다.
  for (const derivative of [
    "Capryloyl Salicylic Acid",
    "Lipohydroxy Acid",
    "LHA",
    "카프릴로일살리실릭애씨드",
    "Betaine Salicylate",
    "BHA",
  ]) {
    const idx = indexIngredients(coerceIngredientListUnknown([`Water, ${derivative}, Glycerin`]));
    assert.ok(
      matchAllergenByCanonical(toCanonical("Salicylic Acid"), idx),
      `살리실산 회피가 «${derivative}» 를 걸러야 한다`
    );
  }

  // `Benzyl Salicylate` 는 이름만 닮았을 뿐 각질제거 성분이 아니라 향료 알레르겐이다.
  // 묶으면 서로를 잘못 거른다 — 양방향 모두 확인한다.
  const benzyl = indexIngredients(coerceIngredientListUnknown(["Water, Benzyl Salicylate, Glycerin"]));
  assert.equal(
    matchAllergenByCanonical(toCanonical("Salicylic Acid"), benzyl),
    null,
    "살리실산 회피가 벤질살리실레이트를 걸러선 안 된다"
  );
  const bha = indexIngredients(coerceIngredientListUnknown(["Water, Salicylic Acid, Glycerin"]));
  assert.equal(
    matchAllergenByCanonical(toCanonical("Benzyl Salicylate"), bha),
    null,
    "벤질살리실레이트 회피가 살리실산을 걸러선 안 된다"
  );
}

// ── 숫자 사이 쉼표는 구분자가 아니다 (2026-08-04) ──
{
  // `1,2-Hexanediol` 을 쪼개면 `1` 이라는 조각이 생기고 나머지가 `2-Hexanediol` 이
  // 되어 성분 사전과 대조가 안 된다. 이름 **앞의** 쉼표는 정상적으로 쪼개야 한다.
  assert.deepEqual(
    coerceIngredientListUnknown(["Water, Glycerin, 1,2-Hexanediol, Niacinamide"]),
    ["Water", "Glycerin", "1,2-Hexanediol", "Niacinamide"]
  );
  assert.deepEqual(
    coerceIngredientListUnknown(["정제수, 1,2-헥산다이올, 글리세린"]),
    ["정제수", "1,2-헥산다이올", "글리세린"]
  );
  assert.deepEqual(
    coerceIngredientListUnknown(["Water, 1,3-Butylene Glycol, Panthenol"]),
    ["Water", "1,3-Butylene Glycol", "Panthenol"]
  );
  // 다른 구분자는 그대로 동작해야 한다
  assert.deepEqual(coerceIngredientListUnknown(["Water; Glycerin/Panthenol·Allantoin"]), [
    "Water",
    "Glycerin",
    "Panthenol",
    "Allantoin",
  ]);
}


  // 2026-08-07 국내몰 실측 — 기능성 표시·법령 인용·제형 라벨이 성분표에 섞여 온다.
  {
    const t = splitIngredientTokens("정제수, 주름개선, 아데노신 ｢화장품법｣에 따른, [블루드롭] 정제수, 1,2-헥산다이올");
    assert.deepEqual(t, ["정제수", "아데노신", "정제수", "1,2-헥산다이올"]);
  }
  // 잘라낸 자리에 여는 괄호만 남으면 안 된다.
  assert.equal(stripIngredientNoticeTail("아데노신 ｢화장품법｣에 따른"), "아데노신");
  assert.equal(stripIngredientNoticeTail("에틸헥산다이올 사용 시의"), "에틸헥산다이올");
  assert.equal(stripIngredientNoticeTail("자외선 차단제품 등) 의 경우 주름개선"), "");
  // 정상 성분명은 절대 건드리지 않는다 — 과잉 절단이 더 위험하다.
  for (const keep of ["글리세린", "부틸렌글라이콜", "1,2-헥산다이올", "Butylene Glycol"]) {
    assert.equal(stripIngredientNoticeTail(keep), keep);
  }

    assert.equal(stripIngredientNoticeTail("아세틸옥타펩타이드-3 사용상의"), "아세틸옥타펩타이드-3");

  
  // 앞머리에 붙은 화면 문구 — 2026-08-08 에이프릴스킨 실측.
  // 네 제품이 전부 `보기 정제수` 토큰 하나 때문에 막혀 있었다.
  {
    const t = splitIngredientTokens("보기 정제수, 글리세린, 알로에베라잎수");
    assert.deepEqual(t, ["정제수", "글리세린", "알로에베라잎수"]);
  }
  assert.deepEqual(splitIngredientTokens("자세히보기 정제수, 판테놀"), ["정제수", "판테놀"]);
  // 라벨이 없으면 그대로 둔다.
  assert.deepEqual(splitIngredientTokens("정제수, 부틸렌글라이콜"), ["정제수", "부틸렌글라이콜"]);

  
  // 목록 기호가 성분명 앞에 딸려 온다 — 2026-08-08 티르티르·편강율 실측.
  assert.deepEqual(
    splitIngredientTokens("+ 정제수, 글리세린, 시트릭애씨드 사용할 때, • Astragalus Root Extract"),
    ["정제수", "글리세린", "시트릭애씨드", "Astragalus Root Extract"]
  );
  // 이름 일부인 기호는 건드리지 않는다.
  assert.deepEqual(splitIngredientTokens("1,2-헥산다이올, 부틸렌글라이콜"), ["1,2-헥산다이올", "부틸렌글라이콜"]);
  assert.equal(stripIngredientNoticeTail("마데카식애씨드 사용할 때"), "마데카식애씨드");

  
  // 쇼핑몰 화면 글자가 성분표에 섞여 온다 — 2026-08-08 참존 실측.
  // 라벨은 두 겹으로 붙는다(`보러가기 전성분 정제수`).
  assert.deepEqual(
    splitIngredientTokens("보러가기 전성분 정제수, 글리세린, 향료 닫기 특이사항, 장바구니 바로구매 선물하기 상세 정보"),
    ["정제수", "글리세린", "향료"]
  );

  console.log("ingredient-notice-tail self-test: ok");

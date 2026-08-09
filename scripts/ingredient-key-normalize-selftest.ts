/**
 * 사전 키와 토큰 키가 같은 규칙으로 만들어지는지 고정한다.
 *
 * 2026-07-27 확인된 결함: `loadIngredientMaps` 는 `name_ko` 를 소문자화만 해서
 * `폴리쿼터늄-10` 을 키로 썼는데, 토큰 쪽은 `normalizeTextKey` 를 거쳐
 * `폴리쿼터늄 10` 이 된다. 하이픈 하나 때문에 사전에 이미 있는 성분이
 * 미매칭으로 떨어졌다. 별칭을 아무리 추가해도 이 짝은 만나지 못한다.
 */
import assert from "node:assert/strict";
import {
  ingredientNameVariants,
  isIngredientTokenKnown,
  normalizeTextKey,
} from "../src/lib/pipeline/ingredient-normalize";
import {
  attachIngredientMatches,
  buildIngredientLookupMaps,
  normalizeTextKey,
  parseIngredientList,
  type IngredientLookupMaps,
} from "../src/lib/pipeline/ingredient-normalize";

// --- 정규화 자체 ---------------------------------------------------------

assert.equal(normalizeTextKey("Polyquaternium-10"), "polyquaternium 10");
assert.equal(normalizeTextKey("폴리쿼터늄-10"), "폴리쿼터늄 10");
assert.equal(normalizeTextKey("PEG-45 Stearate"), "peg 45 stearate");
assert.equal(normalizeTextKey("  Butylene   Glycol "), "butylene glycol");
assert.equal(normalizeTextKey(null), "");

// 하이픈과 공백 표기가 같은 키로 수렴해야 짝이 만난다.
assert.equal(
  normalizeTextKey("폴리쿼터늄-10"),
  normalizeTextKey("폴리쿼터늄 10"),
  "하이픈 표기 차이는 흡수돼야 한다"
);

// --- 매칭 경로 -----------------------------------------------------------

/** loadIngredientMaps 가 실제로 쓰는 빌더를 그대로 태운다. */
const buildMaps = (
  rows: Array<{ id: number; slug?: string; name_en?: string; name_ko?: string }>,
  aliases: Array<{ ingredient_id: number; normalized_alias: string }> = []
): IngredientLookupMaps => buildIngredientLookupMaps(rows, aliases);

const matchOf = (raw: string, maps: IngredientLookupMaps) =>
  attachIngredientMatches(parseIngredientList(raw), maps).normalized;

// 하이픈만 다른 한글 표기가 사전 항목을 찾아낸다.
{
  const maps = buildMaps([{ id: 748, name_ko: "폴리쿼터늄-10" }]);
  const [hit] = matchOf("폴리쿼터늄-10", maps);
  assert.equal(hit?.matchedIngredientId, 748, "하이픈 표기가 매칭돼야 한다");
}

// 별칭으로 영문 전용 성분에 한글명이 붙는다 (이번 사전 보강의 핵심 경로).
{
  const maps = buildMaps(
    [{ id: 4, name_en: "Butylene Glycol" }],
    [{ ingredient_id: 4, normalized_alias: "부틸렌글라이콜" }]
  );
  const [hit] = matchOf("부틸렌글라이콜", maps);
  assert.equal(hit?.matchedIngredientId, 4, "한글 별칭이 영문 성분을 찾아야 한다");
  assert.equal(hit?.matchKind, "alias");
}

// 중복 행이 있으면 그 키는 매칭에서 빠진다. 그냥 Map 에 넣으면 나중 행이
// 앞 행을 덮어써 «조용히 아무거나» 고르게 된다 — 사전에 «-nk» 그림자 행이
// 남아 있을 때 실제로 그랬다. 틀린 성분을 붙이느니 미매칭이 낫다.
{
  const built = buildIngredientLookupMaps([
    { id: 35, name_en: "2-Hexanediol" },
    { id: 1005, name_en: "2 Hexanediol" },
  ]);
  assert.equal(built.collisions.length, 1, "중복 키가 보고돼야 한다");
  assert.match(built.collisions[0]!, /name_en "2 hexanediol": 35, 1005/);

  const [hit] = matchOf("2-Hexanediol", built);
  assert.equal(hit?.matchedIngredientId, null, "중복은 임의로 고르면 안 된다");
  assert.equal(hit?.needsReview, true);
}

// 중복이 아닌 항목은 충돌 배제에 휩쓸리지 않는다.
{
  const built = buildIngredientLookupMaps([
    { id: 35, name_en: "2-Hexanediol" },
    { id: 1005, name_en: "2 Hexanediol" },
    { id: 4, name_en: "Butylene Glycol" },
  ]);
  const [hit] = matchOf("Butylene Glycol", built);
  assert.equal(hit?.matchedIngredientId, 4);
}

// 사전에 없는 성분은 needs_review 로 남는다 (없는 걸 지어내지 않는다).
{
  const [hit] = matchOf("존재하지않는성분명", buildMaps([{ id: 1, name_en: "Water" }]));
  assert.equal(hit?.matchedIngredientId, null);
  assert.equal(hit?.needsReview, true);
}


  // ── 한글 성분명 안에 끼어든 공백 (2026-08-08 참존 실측) ──
  // 몰이 줄바꿈한 자리에 공백이 남아 `나이아 신아마이드` 로 갈라져 온다.
  // 붙인 형태가 **사전에 그대로 있을 때만** 같은 성분으로 본다.
  {
    const known = new Set<string>();
    for (const n of ["나이아신아마이드", "트로메타민", "벤질글라이콜", "Butylene Glycol"])
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k) known.add(k);
      }
    for (const t of ["나이아 신아마이드", "트로메타 민", "벤질글라이 콜", "나이아신아마이드"])
      assert.ok(isIngredientTokenKnown(t, known), `공백만 다른데 못 알아봤다: ${t}`);
    // 사전에 없는 이름을 공백만 지워서 아는 척하면 안 된다.
    assert.equal(isIngredientTokenKnown("모르는 성분", known), false);
    assert.equal(isIngredientTokenKnown("모 르 는 성 분", known), false);
  }

  
  // ── 사전 한 칸에 이름이 여럿 (2026-08-09) ──
  // 식약처가 동의어를 쉼표로 이어 준다. 통째로 한 이름으로 보면 어느 쪽으로도
  // 못 찾는다 — `Cynanchum Atratum Extract` 하나 때문에 제품 5건이 막혀 있었고,
  // 그 성분은 사전에 **이미 있었다**.
  {
    const known = new Set<string>();
    for (const n of ["Vincetoxicum Atratum Extract,Cynanchum Atratum Extract", "1,2-Hexanediol"])
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k) known.add(k);
      }
    assert.ok(isIngredientTokenKnown("Cynanchum Atratum Extract", known));
    assert.ok(isIngredientTokenKnown("Vincetoxicum Atratum Extract", known));
    // 숫자 사이의 쉼표는 이름의 일부다 — 쪼개면 안 된다.
    assert.ok(isIngredientTokenKnown("1,2-Hexanediol", known));
    assert.equal(isIngredientTokenKnown("2-Hexanediol", known), false);
  }

  console.log("ingredient key normalize selftest: ok");

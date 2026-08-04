/**
 * 활성화 게이트 회귀 테스트 — 특히 **전성분 형태 검증**.
 *
 * 2026-07-29·07-30 두 번, 추출기가 페이지 문구를 전성분으로 저장했고 그 상태로
 * 활성화가 진행됐다. 데이터를 되돌리는 것으로는 재발을 못 막는다. 게이트가
 * `ingredientsTextValid` 를 요구하도록 고쳤고, 이 테스트가 그것을 지킨다.
 *
 * 실행: npm run test:product-verify-gate
 */
import assert from "node:assert/strict";
import {
  evaluateProductVerificationGate,
  type ProductVerifyGateInput,
} from "../src/lib/pipeline/product-verify/product-verify-gate";

/** 게이트를 통과하는 기준 입력. 각 테스트는 여기서 한 가지만 바꾼다. */
function passing(overrides: Partial<ProductVerifyGateInput> = {}): ProductVerifyGateInput {
  return {
    active: false,
    verifiedAt: null,
    qualityGrade: "B",
    allowedGrades: ["A", "B", "C"],
    hasOfficialIngredientsText: true,
    ingredientsTextValid: true,
    structuredOfficialIngredientCount: 30,
    ambiguousIngredientCount: 0,
    unmatchedIngredientCount: 0,
    safetyConflict: false,
    verifiedInStockOfferCount: 1,
    countryEligibleOfferCount: 1,
    allowPublish: false,
    allowProductDemotion: false,
    ...overrides,
  };
}

// ── 기준 입력은 통과한다 (테스트가 의미를 가지려면 이게 먼저 참이어야 한다)
{
  const r = evaluateProductVerificationGate(passing());
  assert.equal(r.canActivate, true, `기준 입력이 막혔다: ${r.blockers.join(", ")}`);
  assert.deepEqual(r.blockers, []);
}

// ── 전성분이 성분표 형태가 아니면 활성화를 막는다
{
  const r = evaluateProductVerificationGate(passing({ ingredientsTextValid: false }));
  assert.equal(r.canActivate, false, "오염된 전성분으로 활성화되면 안 된다");
  assert.ok(
    r.blockers.includes("official_ingredients_text_invalid"),
    `블로커: ${r.blockers.join(", ")}`
  );
  // 사람이 봐야 하는 건이다 — 조용히 버려지면 안 된다.
  assert.equal(r.needsReview, true);
}

// ── 전성분이 아예 없으면 «없음» 으로만 막는다 («형태 아님» 이 겹쳐 나오지 않는다)
{
  const r = evaluateProductVerificationGate(
    passing({ hasOfficialIngredientsText: false, ingredientsTextValid: false })
  );
  assert.ok(r.blockers.includes("official_ingredients_text_missing"));
  assert.ok(
    !r.blockers.includes("official_ingredients_text_invalid"),
    "없는 것과 형태가 틀린 것은 다른 사유다 — 둘이 같이 나오면 원인 파악이 흐려진다"
  );
}

// ── 기존 블로커가 그대로 살아 있는지 (이번 변경으로 깨지지 않았는지)
{
  const cases: Array<[Partial<ProductVerifyGateInput>, string]> = [
    [{ allowPublish: true }, "allowPublish_must_be_false"],
    [{ allowProductDemotion: true }, "allowProductDemotion_must_be_false"],
    [{ qualityGrade: "D" }, "quality_grade_D"],
    [{ structuredOfficialIngredientCount: 0 }, "structured_ingredients_missing"],
    [{ ambiguousIngredientCount: 1 }, "ingredient_ambiguity"],
    [{ unmatchedIngredientCount: 1 }, "ingredient_unmatched"],
    [{ safetyConflict: true }, "safety_conflict"],
    [{ verifiedInStockOfferCount: 0 }, "verified_offer_missing"],
    [{ countryEligibleOfferCount: 0 }, "country_eligible_offer_missing"],
  ];
  for (const [override, expected] of cases) {
    const r = evaluateProductVerificationGate(passing(override));
    assert.equal(r.canActivate, false, `${expected} 가 막지 못했다`);
    assert.ok(r.blockers.includes(expected), `${expected} 없음 — ${r.blockers.join(", ")}`);
  }
}

// ── 자동 게시는 절대 안 된다 (§ 카탈로그 원칙)
{
  const r = evaluateProductVerificationGate(passing({ allowPublish: true }));
  assert.equal(r.canAutoVerify, false);
}

console.log("product-verify-gate self-test: ok");

/**
 * `extractLabeledIngredientsRaw` 오염 방지 검증.
 *
 * 2026-07-29 Production 반영에서 24건 중 18건에 성분이 아닌 문구가 들어갔다.
 * 아래 «오염 사례» 는 그때 실제로 DB 에 들어간 값이다. 다시 통과하면 안 된다.
 *
 * 실행: npm run test:ingredient-extract-contamination
 */
import assert from "node:assert/strict";
import { extractLabeledIngredientsRaw } from "../src/lib/catalog/enrichment/extractLabeledIngredients";

/** 2026-07-29 에 실제로 잘못 들어간 문구들 */
const CONTAMINATION_CASES: ReadonlyArray<{ label: string; html: string }> = [
  {
    label: "네비게이션 메뉴",
    html: `<div>Ingredients</div><div>Body From Skin to Hair Care
Body Care
Hair
Hydrating! What sensitive skin owner needs
Watery, spray type toner provides relief to irritated skin
Shop All
New Arrivals</div>`,
  },
  {
    label: "보관 주의사항",
    html: `<p>Ingredients:</p><p>avoid storing in high temperatures
keep out of reach of children
discontinue use if irritation occurs
consult a physician
store in a cool dry place</p>`,
  },
  {
    label: "판촉 문구",
    html: `<div>Ingredients</div><div>$24 Value
Lip Sleeping Mask
Nourish
Best Seller
Free Shipping
Add to Cart</div>`,
  },
  {
    label: "카테고리 목록",
    html: `<span>Ingredients</span><span>Travel Sizes
Merch
Clearance
Product Type
Ampoule
Serum
Toner</span>`,
  },
  {
    label: "섹션 제목만",
    html: `<h3>Ingredients</h3><h3>BENEFITS &bull; HOW TO USE &bull; REVIEWS &bull; SHIPPING</h3>`,
  },
];

for (const c of CONTAMINATION_CASES) {
  const got = extractLabeledIngredientsRaw(c.html);
  assert.equal(got, null, `«${c.label}» 이 전성분으로 통과했다: ${got?.raw.slice(0, 60)}`);
}

// ── 진짜 전성분은 계속 통과해야 한다 (과잉 차단 방지)
{
  const html = `<div>Ingredients: Water, Dipropylene Glycol, Glycerin, Butylene Glycol,
Niacinamide, 1,2-Hexanediol, Panthenol, Sodium Hyaluronate, Allantoin,
Carbomer, Tromethamine, Ethylhexylglycerin, Disodium EDTA</div>`;
  const got = extractLabeledIngredientsRaw(html);
  assert.ok(got, "정상 전성분이 거부됐다");
  assert.ok(got!.raw.toLowerCase().startsWith("water"), `시작이 이상하다: ${got!.raw.slice(0, 40)}`);
  assert.ok(got!.raw.includes("Niacinamide"));
}

{
  // 한글 전성분
  const html = `<p>전성분</p><p>정제수, 글리세린, 부틸렌글라이콜, 나이아신아마이드, 판테놀,
소듐하이알루로네이트, 알란토인, 카보머, 다이소듐이디티에이</p>`;
  const got = extractLabeledIngredientsRaw(html);
  assert.ok(got, "한글 전성분이 거부됐다");
  assert.ok(got!.raw.includes("나이아신아마이드"));
}

{
  // 2026-08-09 **의도한 변경**: 용매(물·글리세린)가 없어도 «거의 모든 화장품에
  // 들어가는 성분» 이 하나라도 있으면 목록으로 본다.
  //
  // 예전 규칙은 용매를 요구했고, 그래서 오일 제품과 `달팽이점액여과물` 로 시작하는
  // 크림이 통째로 «전성분 없음» 으로 버려졌다(COSRX 스네일 92 실측).
  // 이 오일 목록은 **진짜 전성분**이므로 뽑히는 게 맞다.
  const oilOnly = `<div>Ingredients: Simmondsia Chinensis Seed Oil, Tocopherol, Rosa Canina Fruit Oil</div>`;
  assert.ok(extractLabeledIngredientsRaw(oilOnly), "진짜 오일 전성분인데 거부됐다");

  // **흔한 성분이 하나도 없으면 여전히 안 뽑는다** — 넓힌 게 아니라 정확해진 것이다.
  const noSignal = `<div>Ingredients: Best Choice, Free Shipping, Made In Korea</div>`;
  assert.equal(extractLabeledIngredientsRaw(noSignal), null, "성분 신호가 없는데 뽑혔다");
}

console.log("ingredient-extract-contamination self-test: ok");

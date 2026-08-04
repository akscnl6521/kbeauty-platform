/**
 * 전성분 검증기 회귀 테스트.
 *
 * 실제 오염 사례를 그대로 넣는다 — 2026-07-29 Production 에 저장됐다가 되돌린
 * 18건, 2026-07-30 재수집에서 다시 나온 마케팅 문구가 표본이다.
 *
 * 실행: npm run test:ingredient-list-validate
 */
import assert from "node:assert/strict";
import { sanitizeIngredientList, validateIngredientList } from "../src/lib/catalog/validateIngredientList";

const ok = (s: string, why: string) => {
  const v = validateIngredientList(s);
  assert.equal(v.ok, true, `통과해야 한다 (${why}): ${v.ok ? "" : v.reason + " / " + (v.sample ?? "")}`);
};
const reject = (s: string, why: string) => {
  const v = validateIngredientList(s);
  assert.equal(v.ok, false, `반려해야 한다 (${why})`);
};

// ── 정상 전성분은 통과한다 ──
ok(
  "Water, Glycerin, Butylene Glycol, Niacinamide, 1,2-Hexanediol, Sodium Hyaluronate, " +
    "Panthenol, Allantoin, Carbomer, Ethylhexylglycerin",
  "표준 INCI 목록"
);
ok(
  "Aqua/Water/Eau, Dipropylene Glycol, Centella Asiatica Extract, Butyrospermum Parkii (Shea) Butter, " +
    "Caprylic/Capric Triglyceride, Tocopherol, Citric Acid",
  "슬래시 동의어·괄호·슬래시 성분명"
);
ok(
  "정제수, 글리세린, 부틸렌글라이콜, 나이아신아마이드, 판테놀, 알란토인, 카보머",
  "한글 전성분"
);
ok(
  "Water, Glycerin, Propanediol, Ascorbic Acid, Sodium Hyaluronate, Panthenol, " +
    "Fragrance / Parfum, Limonene, Linalool",
  "향료·알레르겐 표기"
);

// ── 2026-07-29 실제 오염 사례 ──
reject(
  "Body From Skin to Hair Care, Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol",
  "내비게이션 문구"
);
reject("works, Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin", "동사 조각");
reject(
  "Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin, &times",
  "HTML 엔티티"
);
reject(
  "2025, Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin",
  "연도"
);

// ── 2026-07-30 재수집 오염 사례 ──
reject(
  "Pore-refining. #HIGH-CONCENTRATION #Brightening #PUREVITAMIN, Water, Glycerin, " +
    "Butylene Glycol, Ascorbic Acid, Panthenol",
  "해시태그"
);
reject(
  "Water, Glycerin, Butylene Glycol, Ascorbic Acid, Panthenol, get a welcome offer, email-only",
  "마케팅 문구"
);
reject(
  "Water, Glycerin, Butylene Glycol, Ascorbic Acid, Panthenol, " +
    "first dibs on new products. COMPANY About Us Our Ingredients",
  "푸터 메뉴"
);
reject(
  "safest pure vitamin C Brightening.&emsp, Water, Glycerin, Butylene Glycol, Panthenol",
  "HTML 엔티티 + 문구"
);
reject(
  "Water, Glycerin, Butylene Glycol, Panthenol, Allantoin, " +
    "Ideal for dull, tired, or uneven skin, Carbomer",
  "적합 피부 설명"
);

// ── 무수 제형 — 물·글리세린이 없는 게 정상이다 ──
ok(
  "Oryza Sativa (Rice) Bran Oil, Helianthus Annuus (Sunflower) Seed Oil, " +
    "Caprylic/Capric Triglyceride, Simmondsia Chinensis (Jojoba) Seed Oil, Tocopherol, " +
    "Camellia Seed Oil, Jojoba Oil/Macadamia Seed Oil Esters, " +
    "Prunus Amygdalus Dulcis (Sweet Almond) Oil",
  "페이셜 오일 (하루하루원더 Black Rice Facial Oil 실제 원문)"
);
ok(
  "Silica, Aluminum Starch Octenylsuccinate, Dimethicone/Vinyl Dimethicone Crosspolymer, " +
    "Mica, Zinc Stearate, Tocopherol, Mentha Arvensis Leaf Extract",
  "미네랄 파우더"
);

// ── 형태 검사 ──
reject("", "빈 문자열");
reject("Water, Glycerin", "너무 짧다");
reject(
  "Water Glycerin Butylene Glycol Niacinamide Panthenol Allantoin Carbomer Ethylhexylglycerin Tocopherol",
  "쉼표 구분이 없다"
);
reject(
  "Vitamin C, Retinol, Peptide, Ceramide, Collagen, Adenosine, Allantoin",
  "용제·기제 성분이 없다 (핵심 성분만 나열한 마케팅 목록)"
);
reject(
  "Water, Glycerin, Butylene Glycol, Panthenol, Allantoin, " +
    "This serum visibly improves radiance and reduces the look of fine lines over time",
  "문장 (낱말 8개 초과)"
);
reject(
  "Water, Glycerin, Butylene Glycol, Panthenol, Allantoin, Carbomer, https://example.com/policy",
  "URL"
);
reject(
  "Water, Glycerin, Butylene Glycol, Panthenol, Allantoin, Want 15% off?",
  "물음표"
);

// ── 통과 시 토큰을 돌려준다 ──
{
  const v = validateIngredientList(
    "Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin, Carbomer"
  );
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.tokens.length, 7);
    assert.equal(v.tokens[0], "Water");
    assert.equal(v.tokens[3], "Niacinamide");
  }
}

// ── 슬래시 동의어 표기 (라네즈 립 슬리핑 마스크 실제 원문) ──
ok(
  "DIISOSTEARYL MALATE, HYDROGENATED POLYISOBUTENE, POLYBUTENE, HYDROGENATED POLY(C6-14 OLEFIN), " +
    "MICROCRYSTALLINE WAX / CERA MICROCRISTALLINA / CIRE MICROCRISTALLINE, " +
    "BUTYROSPERMUM PARKII (SHEA) BUTTER, WATER, " +
    "EUPHORBIA CERIFERA (CANDELILLA) WAX / EUPHORBIA CERIFERA CERA / CIRE DE CANDELILLA, " +
    "FRAGRANCE / PARFUM, TITANIUM DIOXIDE (CI 77891)",
  "슬래시 동의어 3중 표기"
);

// ── 꼬리 자르기 ──
{
  // COSRX 비타민C 23 세럼 실제 원문 형태 — 목록 뒤로 본문이 이어진다.
  const real =
    "Aqua/Water, Ascorbic Acid(23%), Butylene Glycol, Dimethicone, Panthenol, " +
    "3-O-Ethyl Ascorbic Acid, Squalane, Sodium Hydroxide, Caffeine, Sodium Hyaluronate, " +
    "Adenosine, Allantoin, Tocopherol, Arginine, Niacinamide, Glutathione, Beta-Carotene " +
    "Still not sure? Ask our AI Shopping Consultant. More details Right BUSTLE BEAUTY " +
    "AWARDS WINNER Achieve Youthful Radiant Skin Brightening.&emsp;slow-aging, 2025, " +
    "on 20 adult participants. WHO IS IT FOR? Vitamin C fans, tired, or uneven skin, " +
    "including fine lines, loss of elasticity, and";
  // 자르지 않으면 반려된다
  assert.equal(validateIngredientList(real).ok, false);
  const s = sanitizeIngredientList(real);
  assert.equal(s.ok, true, `자른 뒤 통과해야 한다: ${s.ok ? "" : s.reason}`);
  if (s.ok) {
    assert.equal(s.tokens[0], "Aqua/Water");
    assert.equal(s.tokens.at(-1), "Beta-Carotene");
    assert.ok(s.cutAtMarker, "목록 끝 표시에서 끊었다고 알려야 한다");
    // 마지막 성분이 쉼표 없이 본문에 붙어 있었는데도 살아남아야 한다 —
    // 전성분은 함량 내림차순이라 끝쪽에 향료·알레르겐이 온다.
    // 잘린 결과에 본문이 남아 있으면 안 된다
    assert.ok(!s.text.includes("BUSTLE"));
    assert.ok(!s.text.includes("&emsp"));
  }
}

// ── 꼬리 경계가 애매하면 자르지 않고 반려한다 ──
{
  // 성분 형태 판정이 한 항목에서 틀렸다고 가정 — 그 뒤가 전부 진짜 성분이면
  // 자르면 알레르겐(Limonene·Linalool)이 사라진다. 그런 경우는 반려해야 한다.
  const ambiguous =
    "Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin, " +
    "Weird Thing: With Colon, " +
    "Sodium Hyaluronate, Adenosine, Tocopherol, Carbomer, Xanthan Gum, " +
    "Citric Acid, Limonene, Linalool, Citronellol, Geraniol";
  const s = sanitizeIngredientList(ambiguous);
  assert.equal(s.ok, false, "경계가 애매하면 반려해야 한다");
  if (!s.ok) assert.match(s.reason, /경계/);
}

// ── 앞부분부터 성분이 아니면 반려 (JS 배열 리터럴을 집어온 사례) ──
{
  const js =
    '","works","skin","looks","bottle","use","redness","base","face","difference",' +
    '"sensation","breakouts","appearance","toner","residue","mist","hydrating","calms","water"';
  assert.equal(sanitizeIngredientList(js).ok, false);
}

// ── 깨끗한 목록은 자르지 않는다 ──
{
  const clean = "Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin, Carbomer";
  const s = sanitizeIngredientList(clean);
  assert.equal(s.ok, true);
  if (s.ok) {
    assert.equal(s.droppedTailTokens, 0);
    assert.equal(s.cutAtMarker, false);
    assert.equal(s.text, clean);
  }
}

assert.equal(sanitizeIngredientList("").ok, false);
assert.equal(sanitizeIngredientList(null).ok, false);

console.log("ingredient-list-validate self-test: ok");

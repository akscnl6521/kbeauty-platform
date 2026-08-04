/**
 * 브랜드 스토어 제품명 대조 회귀 테스트.
 *
 * 표본은 전부 2026-07-30 Production 실측에서 나온 실제 짝이다. 지어낸 예가 아니다.
 *
 * 이 대조가 느슨해지면 **엉뚱한 제품의 전성분·가격이 붙는다.** 빈 상태보다 나쁘다.
 * 그래서 «붙어야 하는 것» 만큼 «붙으면 안 되는 것» 을 촘촘히 둔다.
 *
 * 실행: npm run test:brand-store-name-match
 */
import assert from "node:assert/strict";
import {
  findBrandStore,
  nameSimilarity,
  nameTokens,
  NAME_MATCH_MIN,
} from "../src/lib/catalog/brandGlobalStores";

const sim = (dbName: string, storeTitle: string, brand: string) =>
  nameSimilarity(nameTokens(dbName, brand), nameTokens(storeTitle, brand));

const match = (dbName: string, storeTitle: string, brand: string, why: string) => {
  const s = sim(dbName, storeTitle, brand);
  assert.ok(s >= NAME_MATCH_MIN, `연결돼야 한다 (${why}): ${s.toFixed(2)} — «${dbName}» ↔ «${storeTitle}»`);
};
const noMatch = (dbName: string, storeTitle: string, brand: string, why: string) => {
  const s = sim(dbName, storeTitle, brand);
  assert.ok(s < NAME_MATCH_MIN, `연결되면 안 된다 (${why}): ${s.toFixed(2)} — «${dbName}» ↔ «${storeTitle}»`);
};

// ── 같은 제품인데 표기가 다른 것 (실측) ──
match("Peach 70 Niacin Serum", "Peach 70% Niacinamide Serum", "Anua", "성분명 축약 niacin/niacinamide");
match(
  "Relief Sun Rice and Probiotics",
  "Relief Sun : Rice + Probiotics SPF50+ PA++++",
  "Beauty of Joseon",
  "기능어·SPF 표기 차이"
);
match(
  "Advanced Snail 92 All in One Cream",
  "Advanced Snail 92 All in one Cream",
  "COSRX",
  "대소문자만 다름"
);
match(
  "Snail Mucin 96% Power Repairing Essence",
  "Advanced Snail 96 Mucin Power Essence",
  "COSRX",
  "낱말 순서·수식어 차이"
);

// ── 다른 제품 — 붙으면 안 된다 (실측) ──
noMatch(
  "Relief Sun Rice and Probiotics",
  "Birch Juice Moisturizing Sun Serum SPF 50",
  "Round Lab",
  "브랜드 귀속이 틀린 건 — 스토어에 없는 게 맞다"
);
noMatch(
  "Calming Serum Heartleaf and Panthenol",
  "Calming Barrier Serum",
  "Beauty of Joseon",
  "핵심 성분이 다르다"
);
noMatch(
  "Calming Serum Heartleaf and Panthenol",
  "Calming Serum : Green tea + Panthenol",
  "Beauty of Joseon",
  "어성초 vs 녹차 — 다른 제품"
);
noMatch(
  "Peach 70 Niacin Serum",
  "Peach 70 Niacin Brightening Collagen Mask",
  "Anua",
  "세럼 vs 마스크 — 제형이 다르다"
);
noMatch("Cica Serum", "Cicaful Ampoule", "Axis-Y", "세럼 vs 앰플");
noMatch(
  "Green Tea Seed Serum",
  "Green Tea Hyaluronic Cream",
  "Innisfree",
  "같은 라인이지만 다른 제품"
);

// ── 접두 일치가 짧은 낱말까지 번지면 안 된다 ──
{
  // `sun`(3자) 은 접두 일치를 인정하지 않는다 — 인정하면 선크림이 아닌 것까지 묶인다.
  const s = sim("Sun Cream", "Sunscreen Stick", "Tocobo");
  assert.ok(s < NAME_MATCH_MIN, `짧은 낱말 접두 일치는 막아야 한다: ${s.toFixed(2)}`);
}

// ── 한 토큰이 상대쪽 여러 토큰에 걸려 중복으로 세어지면 안 된다 ──
{
  // `serum` 하나가 `serum` 두 번에 걸려 2로 세어지면 점수가 부풀어 오른다.
  const s = nameSimilarity(new Set(["serum"]), new Set(["serum", "serums"]));
  assert.ok(s <= 1, `점수가 1 을 넘으면 안 된다: ${s}`);
}

// ── 브랜드 스토어 조회 ──
assert.equal(findBrandStore("COSRX"), "cosrx.com");
assert.equal(findBrandStore("CosRX"), "cosrx.com", "대소문자 변형도 같은 브랜드");
assert.equal(findBrandStore(" cosrx "), "cosrx.com", "공백만 다른 표기도 같은 브랜드");
assert.equal(findBrandStore("ROUND LAB"), "roundlab.com");
assert.equal(findBrandStore("알 수 없는 브랜드"), null);
assert.equal(findBrandStore(null), null);
assert.equal(findBrandStore(""), null);

// ── 빈 입력 ──
assert.equal(nameSimilarity(new Set(), new Set(["a"])), 0);
assert.equal(nameSimilarity(new Set(["a"]), new Set()), 0);

console.log("brand-store-name-match self-test: ok");

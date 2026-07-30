/**
 * 브랜드별 **글로벌 Shopify 스토어** 도메인, 그리고 제품명 대조 함수.
 *
 * 왜 글로벌 스토어인가 — 국내 Cafe24 몰은 상품명이 한국어라 영문 DB 명과 매칭이
 * 안 되고, 가격·재고가 구조화돼 있지 않다. 같은 브랜드의 글로벌 Shopify 스토어는
 * `/products.json` 이 공개돼 있고 영문 상품명이라 대조가 된다.
 *
 * 도메인은 전부 `scripts/discover-brand-shopify-stores.ts` 로 **실제 응답을 확인한
 * 것만** 넣는다. 이름이 비슷하다고 브랜드 것이라고 단정하지 않는다.
 *
 * 여기 있던 목록이 원래 `scripts/collect-tier1-shopify.ts` 안에 있었는데, 전성분
 * 보강 스크립트도 같은 목록이 필요해져 공유 모듈로 옮겼다. 두 곳에 복사하면
 * 한쪽만 갱신되어 어긋난다.
 */
export type BrandGlobalStore = { brands: string[]; domain: string };

export const BRAND_GLOBAL_STORES: ReadonlyArray<BrandGlobalStore> = [
  { brands: ["COSRX", "CosRX"], domain: "cosrx.com" },
  { brands: ["SKIN1004"], domain: "skin1004.com" },
  { brands: ["Beauty of Joseon"], domain: "beautyofjoseon.com" },
  { brands: ["Round Lab", "ROUND LAB"], domain: "roundlab.com" },
  { brands: ["Laneige"], domain: "us.laneige.com" },
  { brands: ["Sulwhasoo"], domain: "us.sulwhasoo.com" },
  { brands: ["Anua"], domain: "anua.com" },
  { brands: ["Torriden"], domain: "torriden.us" },
  { brands: ["Innisfree"], domain: "us.innisfree.com" },
  { brands: ["Axis-Y"], domain: "axis-y.com" },
  { brands: ["Klairs"], domain: "klairs.com" },
  { brands: ["Haruharu Wonder"], domain: "haruharuwonder.com" },
  { brands: ["Missha"], domain: "misshaus.com" },
  { brands: ["Medicube"], domain: "medicube.us" },
  { brands: ["Ma:nyo"], domain: "manyo.us" },
  { brands: ["TIRTIR"], domain: "tirtir.us" },
  { brands: ["Heimish"], domain: "heimish.us" },
  { brands: ["Rovectin"], domain: "rovectin.com" },
  { brands: ["Tocobo"], domain: "tocobo.us" },
  { brands: ["mixsoon"], domain: "mixsoon.us" },
  { brands: ["Holika Holika"], domain: "holikaholika.com" },
  { brands: ["Pyunkang Yul"], domain: "pyunkangyulglobal.com" },
  { brands: ["Numbuzin"], domain: "us.numbuzin.com" },
  { brands: ["Tonymoly"], domain: "tonymoly.us" },
];

/** 브랜드 표기로 스토어 도메인을 찾는다. 대소문자·공백만 다른 표기도 같게 본다. */
export function findBrandStore(brand: string | null | undefined): string | null {
  const key = String(brand ?? "").trim().toLowerCase();
  if (!key) return null;
  for (const entry of BRAND_GLOBAL_STORES) {
    if (entry.brands.some((b) => b.trim().toLowerCase() === key)) return entry.domain;
  }
  return null;
}

/** 제품명 비교용 정규화 — 브랜드명·용량·기호를 걷어내고 핵심 토큰만 남긴다. */
export function nameTokens(raw: string, brand: string): Set<string> {
  const stripped = String(raw ?? "")
    .toLowerCase()
    .replace(new RegExp(String(brand ?? "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ")
    .replace(/\d+(\.\d+)?\s*(ml|g|oz|매|ea|개|pcs)\b/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ");
  return new Set(stripped.split(/\s+/).filter((t) => t.length >= 2));
}

/**
 * 포함도(containment) — 교집합 / 짧은 쪽 크기.
 *
 * 자카드를 먼저 썼다가 실패했다. 사이트 제목이 «Relief Sun : Rice + Probiotics
 * SPF50+ PA++++» 처럼 DB 이름보다 토큰이 훨씬 많으면, 사실상 같은 제품인데도
 * 합집합이 커져 점수가 0.57 로 떨어진다. 한쪽이 다른 쪽을 «거의 포함» 하는지를
 * 보는 편이 이 경우에 맞다.
 */
export function nameSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

/**
 * 같은 제품으로 인정하는 하한.
 *
 * 애매하면 연결하지 않는다 — 엉뚱한 제품의 가격·성분을 붙이는 것이 빈 상태보다 나쁘다.
 */
export const NAME_MATCH_MIN = 0.8;

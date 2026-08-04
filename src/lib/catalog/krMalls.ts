/**
 * 브랜드 → **국내 공식몰** 도메인.
 *
 * 네이버 쇼핑 API 폐지(§50) 후 국내 오퍼의 유일한 경로다. 국내몰은 `sitemap.xml` 로
 * 제품 목록을, 제품 페이지가 JSON-LD 로 가격·재고를 공개한다.
 *
 * **사이트맵이 실제로 제품 URL 을 돌려주는 곳만 넣는다** (2026-08-04~05 확인).
 * 도메인이 그럴듯하다고 추측해서 넣지 않는다 — 확인 안 된 도메인은 조용히 0건을
 * 돌려주고, 그러면 «그 브랜드는 국내에 없다» 고 잘못 판단하게 된다.
 *
 * 라네즈(`www.laneige.com`)는 사이트맵은 열리지만 JSON-LD 가 **모든 제품 가격을
 * `100`** 으로 준다(자리표시). 수집기가 몰 단위로 걸러내지만, 애초에 여기 두지
 * 않는 편이 명확하다.
 */
export type KrMall = { brands: readonly string[]; domain: string };

export const KR_MALLS: readonly KrMall[] = [
  { brands: ["COSRX", "CosRX"], domain: "www.cosrx.co.kr" },
  { brands: ["Round Lab", "ROUND LAB"], domain: "roundlab.co.kr" },
  { brands: ["Klairs"], domain: "klairs.co.kr" },
  { brands: ["Abib", "Abib Cosmetic"], domain: "abib.co.kr" },
];

/** 브랜드 표기로 국내몰을 찾는다. 대소문자·공백만 다른 표기도 같게 본다. */
export function findKrMall(brand: string | null | undefined): string | null {
  const key = String(brand ?? "").trim().toLowerCase();
  if (!key) return null;
  for (const m of KR_MALLS) {
    if (m.brands.some((b) => b.trim().toLowerCase() === key)) return m.domain;
  }
  return null;
}

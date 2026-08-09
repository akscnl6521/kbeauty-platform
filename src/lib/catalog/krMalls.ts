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
  // 2026-08-07 `npm run probe:kr-malls` 통과 — 제품 221건 · 가격 220건 · 재고 71건.
  //
  // **다만 등록되는 제품은 지금 0건이다.** 이 몰은 전성분을 상세 «이미지» 로만
  // 싣는다 — 페이지 텍스트에 `정제수` 조차 없다. 글로벌 스토어
  // (`pyunkangyulglobal.com`, Shopify 121건) 에도 전성분이 없다.
  // 활성화 게이트가 요구하는 «공식 전성분 텍스트» 를 어디서도 못 얻는다.
  // OCR 로 읽어 채우지 않는다 — 알레르겐 판정에 쓸 만큼 믿을 수 없다.
  //
  // 그래도 남겨 둔다. 오퍼(가격·재고)는 정상이고, 전성분을 텍스트로 내기
  // 시작하면 그날 바로 잡힌다. 지우면 이 확인을 처음부터 다시 하게 된다.
  { brands: ["Pyunkang Yul", "PYUNKANG YUL", "편강율"], domain: "pyunkangyul.com" },
  // 2026-08-08 탐침 통과 — 가격·재고·전성분이 다 있다.
  { brands: ["d'Alba", "dAlba", "DALBA", "달바"], domain: "dalba.co.kr" },
  { brands: ["TIRTIR", "Tirtir", "티르티르"], domain: "tirtir.co.kr" },
  { brands: ["Sulwhasoo", "SULWHASOO", "설화수"], domain: "sulwhasoo.com" },
  // 2026-08-08 탐침 통과 — 제품 58 · 가격 10/10 · 재고 7 · 전성분 9/10.
  { brands: ["April Skin", "AprilSkin", "에이프릴스킨"], domain: "aprilskin.com" },
  // 2026-08-08 3차 탐침 통과.
  { brands: ["Dr.Jart+", "Dr. Jart+", "Dr Jart", "닥터자르트"], domain: "drjart.com" },
  { brands: ["Aromatica", "아로마티카"], domain: "aromatica.co.kr" },
  { brands: ["Charmzone", "참존"], domain: "charmzone.co.kr" },
  { brands: ["Jayjun", "JAYJUN", "제이준"], domain: "jayjun.co.kr" },
  { brands: ["SOME BY MI", "Some By Mi", "썸바이미"], domain: "somebymi.com" },
  // 2026-08-09 4차 탐침 통과.
  { brands: ["Celimax", "셀리맥스"], domain: "celimax.co.kr" },
  { brands: ["KAHI", "Kahi", "카히"], domain: "kahi.co.kr" },
];

/**
 * 확인해 봤지만 **쓰지 않기로 한** 도메인. 다시 후보로 올리는 수고를 줄이려고 남긴다.
 *
 *   numbuzin.com     가격·전성분은 정상. `availability` 는 **품절일 때만** 나온다
 *                    (`OutOfStock`). 판매중일 때는 아무 표시가 없다. 즉 «표시가
 *                    없으면 판매중» 이라고 읽어야 쓸 수 있는데, 그건 추측이다.
 *                    틀리면 품절 상품 구매 링크로 사람을 보낸다. 쓰지 않는다.
 *                    (2026-08-08 제품 3건 실측: 22=OutOfStock · 24·25=표시 없음)
 *   hanyul.com       같은 이유 — 표본 3건 모두 `availability` 없음
 *   wellage.co.kr    같은 이유 (전성분 10/10 · 재고 표기 0/10)
 *   illiyoon.com     같은 이유 (전성분 9/10)
 *   mamonde.com      같은 이유 (전성분 10/10)
 *   primera.co.kr    같은 이유 (전성분 8/10)
 *   droracle.co.kr   가격·재고는 정상인데 전성분이 텍스트로 없다 — 편강율과 같은 사례
 *   hera.com         같은 이유 (제품 82 · 전성분 0/10)
 *   laboh.co.kr      같은 이유 (제품 48 · 전성분 0/10)
 *   iope.com         가격·전성분은 정상, 재고 표기 없음
 *   amorepacific.com 같은 이유 (전성분 10/10 인데 재고 표기 0/10)
 *   mixsoon.co.kr    가격·재고는 정상인데 전성분이 텍스트로 없다 (제품 155)
 *   nacific.com      같은 이유 (제품 61)
 *   abib.com         Abib 글로벌몰 — 국내몰 `abib.co.kr` 을 이미 쓰고 있어 중복이다
 *
 * **여섯 곳(넘버즈인·한율·웰라쥬·일리윤·마몽드·프리메라)이 가격과 전성분은 다 주고
 * 재고만 안 준다.** 제품 수로는 270건이 넘는다. 넘버즈인을 뜯어보면 `availability`
 * 를 **품절일 때만** 내므로(`OutOfStock`), 「표기가 없으면 판매중」 으로 읽으면 이
 * 전부를 쓸 수 있다.
 *
 * **2026-08-08, 그렇게 하지 않기로 결정했다(운영자 판단).**
 * 제품 수보다 「구매하기가 뜨면 진짜 살 수 있다」 를 지킨다. 표기가 없는 것을
 * 판매중으로 읽는 건 추측이고, 틀리면 품절 상품 구매 링크로 사람을 보낸다.
 *
 * 이 결정을 뒤집으려면 운영자가 다시 말해야 한다 — 재고 판정은 국내 오퍼 자격
 * 조건이고, `PROJECT_RULE`·`CLAUDE.md` 가 **명시적 요청 없이는 바꾸지 말라**고 한다.
 *   roundlab.co.kr   재고도 없고 **전성분도 텍스트로 없다**(10건 표본 0/10).
 *                    KR_MALLS 에는 남아 있으나 등록되는 제품은 0건이다.
 *   torriden.com     제품 URL 5건뿐이고 JSON-LD 가격 없음
 *   www.laneige.com  JSON-LD 가격이 전부 `100` (자리표시)
 *   anua · skin1004 · goodal · isntree · manyo · mixsoon · beautyofjoseon ·
 *   haruharuwonder · clubclio · drg · banilaco · tonymoly · thesaem ·
 *   naturerepublic · skinfood · isoi · cellfusionc · innisfree · aritaum
 *                    사이트맵을 못 찾음 (도메인이 다르거나 사이트맵을 안 낸다)
 *
 * 판정 근거는 `artifacts/kr-malls/probe.json`. 다시 보고 싶으면
 * `npm run probe:kr-malls -- <도메인>` 으로 한 곳만 확인할 수 있다.
 *
 * **표본은 사이트맵 앞쪽이 아니라 고르게 퍼뜨려 뽑는다.** 앞 6건만 봤을 때는
 * 달바가 「가격 0/6」 으로 탈락했지만, 고르게 뽑으니 「가격 9/10 · 재고 9」 였다.
 */
export const KR_MALLS_REJECTED = [
  "numbuzin.com",
  "hanyul.com",
  "torriden.com",
  "www.laneige.com",
] as const;

/** 브랜드 표기로 국내몰을 찾는다. 대소문자·공백만 다른 표기도 같게 본다. */
export function findKrMall(brand: string | null | undefined): string | null {
  const key = String(brand ?? "").trim().toLowerCase();
  if (!key) return null;
  for (const m of KR_MALLS) {
    if (m.brands.some((b) => b.trim().toLowerCase() === key)) return m.domain;
  }
  return null;
}

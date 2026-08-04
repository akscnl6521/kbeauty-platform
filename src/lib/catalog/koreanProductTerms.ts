/**
 * 화장품 제품명에 쓰이는 **한글 음역 ↔ 영문** 대응.
 *
 * 왜 필요한가 — 국내 유통 제품명은 영문을 음역해서 적는다.
 *
 *   `AC Collection Lightweight Soothing Moisturizer`
 *   `AC 컬렉션 라이트웨이트 수딩 모이스처라이저`
 *
 * 토큰만 비교하면 `AC` 하나만 겹쳐 유사도 0.2 가 나온다. 실제로는 같은 제품인데
 * 매칭에 실패한다(2026-07-30 네이버 쇼핑 대조에서 17건 중 13건이 이렇게 빠졌다).
 *
 * 여기 담은 것은 **표준 음역**이다 — 지어낸 대응이 아니라 국내 화장품 업계가
 * 실제로 쓰는 표기다. 확신이 없는 낱말은 넣지 않았다. 빠진 낱말이 있으면 매칭이
 * 안 될 뿐이고, 잘못된 대응을 넣으면 엉뚱한 제품에 붙으므로 후자를 피한다.
 */

/** 한글 음역 → 영문. 긴 것이 먼저 치환되도록 길이순으로 정렬해서 쓴다. */
const TRANSLITERATION: ReadonlyArray<readonly [ko: string, en: string]> = [
  // ── 제품 유형
  ["모이스처라이저", "moisturizer"],
  ["클렌징오일", "cleansing oil"],
  ["클렌징폼", "cleansing foam"],
  ["클렌저", "cleanser"],
  ["에센스", "essence"],
  ["앰플", "ampoule"],
  ["세럼", "serum"],
  ["토너", "toner"],
  ["크림", "cream"],
  ["로션", "lotion"],
  ["미스트", "mist"],
  ["마스크", "mask"],
  ["패드", "pad"],
  ["패치", "patch"],
  ["젤", "gel"],
  ["밤", "balm"],
  ["오일", "oil"],
  ["선크림", "sunscreen"],
  ["선세럼", "sun serum"],
  ["아이크림", "eye cream"],
  ["립밤", "lip balm"],
  ["파운데이션", "foundation"],
  ["쿠션", "cushion"],
  ["파우더", "powder"],

  // ── 기능·효능 수식어
  ["라이트웨이트", "lightweight"],
  ["클래리파잉", "clarifying"],
  ["트리트먼트", "treatment"],
  ["하이드레이팅", "hydrating"],
  ["브라이트닝", "brightening"],
  ["리페어링", "repairing"],
  ["수딩", "soothing"],
  ["카밍", "calming"],
  ["퍼밍", "firming"],
  ["글로우", "glow"],
  ["딥클린", "deep clean"],
  ["인텐시브", "intensive"],
  ["어드밴스드", "advanced"],
  ["컴플리트", "complete"],
  ["오리지널", "original"],
  ["워터리", "watery"],
  ["하이드리움", "hydrium"],
  ["프레시", "fresh"],
  ["마일드", "mild"],
  ["파워", "power"],
  ["부스터", "booster"],
  ["컬렉션", "collection"],
  ["다이브인", "dive in"],
  ["리바이브", "revive"],
  ["오버나이트", "overnight"],
  ["슬리핑", "sleeping"],

  // ── 성분·원료 (제품명에 자주 들어간다)
  ["히알루론산", "hyaluronic acid"],
  ["히알루로닉", "hyaluronic"],
  ["나이아신아마이드", "niacinamide"],
  ["프로폴리스", "propolis"],
  ["스네일", "snail"],
  ["뮤신", "mucin"],
  ["펩타이드", "peptide"],
  ["레티놀", "retinol"],
  ["레티날", "retinal"],
  ["세라마이드", "ceramide"],
  ["판테놀", "panthenol"],
  ["센텔라", "centella"],
  ["마다가스카르", "madagascar"],
  ["어성초", "heartleaf"],
  ["흑미", "black rice"],
  ["블랙라이스", "black rice"],
  ["카페인", "caffeine"],
  ["콜라겐", "collagen"],
  ["비피다", "bifida"],
  ["바이옴", "biome"],
  ["글루타치온", "glutathione"],
  ["티트리", "tea tree"],
  ["알로에", "aloe"],
  ["그린티", "green tea"],
  ["녹차", "green tea"],
  ["쌀", "rice"],
  ["라이스", "rice"],
  ["자작나무", "birch"],
  ["버치", "birch"],
  ["엑토인", "ectoin"],
  ["카카오", "cacao"],
  ["복숭아", "peach"],
  ["피치", "peach"],
  ["바하", "bha"],
  ["아하", "aha"],
  ["비타민", "vitamin"],
  ["비타", "vita"],

  // ── 2026-08-05 추가 — 국내몰 스냅샷의 **실제 표기와 DB 이름 쌍**에서 확인한 것만.
  //    지어낸 대응은 없다. 각 줄 옆이 그 짝을 확인한 제품이다.
  ["올인원", "all in one"],            // 스네일 92 올인원 크림 ↔ Advanced Snail 92 All in One Cream
  ["미드나잇", "midnight"],            // 미드나잇 블루 카밍 크림 ↔ Midnight Blue Calming Cream
  ["블루", "blue"],                   //   〃
  ["굿모닝", "good morning"],          // 약산성 굿모닝 젤 클렌저 ↔ Low pH Good Morning Gel Cleanser
  ["시트", "sheet"],                  // 약산성 시트 마스크 어성초 핏 ↔ Mild Acidic pH Sheet Mask Heartleaf Fit
  ["핏", "fit"],                     //   〃
  ["워터", "water"],                  // 센텔라 워터 알콜-프리 토너 ↔ Centella Water Alcohol-Free Toner
  ["알콜", "alcohol"],                //   〃 (`알코올` 과 표기가 다르다)
  ["프리", "free"],                   //   〃
  ["서플", "supple"],                 // 서플 프레퍼레이션 언센티드 토너 ↔ Supple Preparation Unscented Toner
  ["프레퍼레이션", "preparation"],      //   〃
  ["언센티드", "unscented"],           //   〃
  ["페이셜", "facial"],                // 같은 라인의 «페이셜» 판을 **구분하기 위해** 넣는다
  ["어드벤스드", "advanced"],          // 어드벤스드 스네일 96 뮤신 ↔ Snail Mucin 96% (기존 `어드밴스드` 와 표기가 다르다)
  ["히아루론산", "hyaluronic acid"],   // 히아루론산 인텐시브 크림 (기존 `히알루론산` 과 표기가 다르다)
  ["리퀴드", "liquid"],                // 아하 7 화이트헤드 파워 리퀴드 ↔ … Power Liquid
  ["화이트헤드", "whitehead"],         //   〃
  ["폼", "foam"],                     // AC 컬렉션 카밍 폼 클렌저
  ["모이스쳐라이징", "moisturizing"],   // 오일-프리 울트라 모이스쳐라이징 로션
  ["울트라", "ultra"],                //   〃
  ["리프팅", "lifting"],               // 실루엣 리프팅 크림 마스크
  ["블랙", "black"],
  ["스네일", "snail"],
];

/** 브랜드 한글 표기 → 영문. 네이버 검색으로 확인된 것만 둔다. */
export const BRAND_KO_TO_EN: ReadonlyMap<string, string> = new Map([
  ["코스알엑스", "cosrx"],
  ["토리든", "torriden"],
  ["하루하루", "haruharu"],
  ["하루하루원더", "haruharu wonder"],
  ["아누아", "anua"],
  ["조선미녀", "beauty of joseon"],
  ["스킨1004", "skin1004"],
  ["라운드랩", "round lab"],
  ["라네즈", "laneige"],
  ["설화수", "sulwhasoo"],
  ["아비브", "abib"],
  ["넘버즈인", "numbuzin"],
  ["이즈앤트리", "isntree"],
  ["아이소이", "isoi"],
  ["메디큐브", "medicube"],
  ["마녀공장", "manyo"],
  ["미샤", "missha"],
  ["이니스프리", "innisfree"],
  ["클레어스", "klairs"],
  ["엑시스와이", "axis-y"],
]);

/** 긴 낱말이 먼저 치환되도록 미리 정렬 */
const SORTED = [...TRANSLITERATION].sort((a, b) => b[0].length - a[0].length);

/**
 * 한글 제품명을 **비교용 영문 문자열**로 바꾼다.
 *
 * 음역 사전에 있는 낱말은 영문으로, 없는 한글은 그대로 남긴다(남은 한글은 비교에서
 * 자연히 안 맞을 뿐이라 해가 없다). 브랜드 표기도 같이 영문으로 바꾼다.
 */
export function koreanProductNameToComparable(raw: string): string {
  let out = String(raw ?? "").toLowerCase();
  for (const [ko, en] of BRAND_KO_TO_EN) out = out.split(ko).join(` ${en} `);
  for (const [ko, en] of SORTED) out = out.split(ko).join(` ${en} `);
  return out.replace(/\s+/g, " ").trim();
}

/**
 * 영문 제품명 → **네이버 검색용 짧은 한글 질의**.
 *
 * 긴 영문 질의는 국내 쇼핑 색인에서 결과가 0건으로 나온다(2026-07-30 실측:
 * `조선미녀 Glow Serum Propolis and Niacinamide` 0건 → `조선미녀 글로우 세럼` 14건).
 * 사전에 있는 낱말만 한글로 바꿔 **짧고 신호가 센 질의**를 만든다.
 *
 * 사전에 없는 낱말은 **버린다**. 억지로 음역하면 없는 제품을 검색하게 된다.
 * `and` · `with` 같은 기능어도 뺀다.
 */
const STOPWORDS = new Set(["and", "with", "for", "the", "a", "of", "in", "plus"]);

export function englishProductNameToKoreanQuery(nameEn: string): string {
  // 영문 → 한글 대응을 역방향으로 만든다 (같은 영문에 여러 한글이 있으면 첫 것)
  const enToKo = new Map<string, string>();
  for (const [ko, en] of TRANSLITERATION) if (!enToKo.has(en)) enToKo.set(en, ko);

  const src = String(nameEn ?? "").toLowerCase();
  const out: string[] = [];

  // 두 낱말 짝(`eye cream` · `black rice`)을 먼저 본다
  const words = src
    .replace(/[^a-z0-9%.\s/+-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const pair = `${words[i]} ${words[i + 1] ?? ""}`.trim();
    if (words[i + 1] && enToKo.has(pair)) {
      out.push(enToKo.get(pair)!);
      i += 1;
      continue;
    }
    const one = words[i];
    if (STOPWORDS.has(one)) continue;
    const ko = enToKo.get(one);
    if (ko) out.push(ko);
    // 숫자·퍼센트는 그대로 살린다 (`96` · `77%` · `0.1` 이 강한 식별자다)
    else if (/^[\d.]+%?$/.test(one)) out.push(one);
  }
  return [...new Set(out)].join(" ").trim();
}

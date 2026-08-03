/**
 * 전성분 문자열이 **실제 INCI 목록인지** 판정한다.
 *
 * 왜 별도 검증기인가 — 추출기(`extractLabeledIngredients`)를 두 번 고쳤는데도
 * 마케팅 문구가 새어 들어왔다. 2026-07-29 에는 오염된 18건이 Production 에 저장돼
 * 되돌려야 했다 (`"Body From Skin to Hair Care..."` · `"works"` · `&times` · `"2025"`).
 * 2026-07-30 재수집에서도 `#HIGH-CONCENTRATION` · `get a welcome offer` ·
 * `COMPANY About Us Our Ingredients` 가 다시 나왔다.
 *
 * 추출기를 계속 조이는 것만으로는 부족하다. 페이지 구조는 브랜드마다 다르고 계속
 * 바뀐다. **쓰기 직전에 한 번 더 막는 관문**이 필요하다 — 오염된 성분표는 안전
 * 필터(알레르겐 검사)의 입력이므로, 쓰레기가 들어가면 "안전"이라는 판정 자체가
 * 무의미해진다. 통과 못 하면 저장하지 않고 사람이 보게 남긴다.
 *
 * 판정은 **보수적**이다 — 의심스러우면 반려한다. 놓친 제품은 그냥 활성화가 늦어질
 * 뿐이지만, 통과시킨 쓰레기는 사용자에게 잘못된 안전 정보로 간다.
 */

/** INCI 이름에 나올 수 없는 표시. 하나라도 있으면 목록 전체를 반려한다. */
const HARD_REJECT_MARKERS: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /&(emsp|nbsp|times|amp|quot|lt|gt|#\d+);?/i, why: "HTML 엔티티" },
  { re: /#[A-Za-z]/, why: "해시태그" },
  { re: /<\/?[a-z]/i, why: "HTML 태그" },
  { re: /\bhttps?:\/\//i, why: "URL" },
  { re: /\b(19|20)\d{2}\b/, why: "연도" },
  { re: /[?!]/, why: "물음표·느낌표" },
  { re: /\.{3}|…/, why: "말줄임" },
];

/**
 * 마케팅·UI 문구에만 나오는 낱말. INCI 이름에는 쓰이지 않는다.
 *
 * 성분명의 일부일 수 있는 낱말(`water` · `acid` · `extract`)은 절대 넣지 않는다.
 */
const MARKETING_WORDS: ReadonlyArray<string> = [
  "welcome offer",
  "about us",
  "our ingredients",
  "sign up",
  "subscribe",
  "add to cart",
  "shop now",
  "free shipping",
  "learn more",
  "read more",
  "customer",
  "reviews",
  "shipping",
  "returns",
  "privacy policy",
  "terms of",
  "follow us",
  "best seller",
  "sold out",
  "how to use",
  "ideal for",
  "suitable for",
  "clinically",
  "dermatologist tested",
  "made in korea",
  "cruelty free",
];

/**
 * INCI 이름에 **절대 나오지 않는 영어 기능어**. 항목 안에 낱말로 들어 있으면 문장이다.
 *
 * `Body From Skin to Hair Care` 처럼 마케팅 문구는 낱말 수·문장부호만으로는 성분명과
 * 구별되지 않는다. 반면 INCI 이름은 명사구뿐이라 전치사·대명사·조동사가 없다.
 *
 * 낱말 단위는 **공백으로만** 나눈다 — `All-Trans Retinol` 의 `All` 이 걸리면 안 된다.
 */
const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  "from", "to", "for", "with", "without", "your", "our", "ours", "this", "that", "these", "those",
  "it", "its", "is", "are", "was", "were", "we", "you", "they", "their", "my", "at", "by", "on",
  "in", "of", "as", "an", "the", "and", "or", "but", "not", "all", "more", "most", "than", "then",
  "so", "very", "can", "will", "up", "out", "about", "into", "over", "after", "before", "when",
  "while", "how", "why", "what", "who", "where", "if", "no", "yes", "get", "has", "have", "been",
  "be", "do", "does", "did", "also", "just", "only", "such", "each", "both", "any", "some", "own",
  "same", "too", "well", "even", "still", "back", "down", "off", "again", "once", "here", "there",
  "now", "may", "every", "other", "which", "them", "us", "me",
]);

/**
 * 낱말 하나로만 이뤄진 항목 중 성분이 아닌 것.
 *
 * 여러 낱말 이름의 일부로는 정당하다 — `sap` 은 `Hedera Helix Sap` 에 실제로 쓰인다.
 * 그래서 **단독 항목일 때만** 반려한다.
 */
const NON_INCI_SINGLE_WORDS: ReadonlySet<string> = new Set([
  "works", "work", "sap", "skin", "hair", "face", "body", "care", "product", "products",
  "offer", "offers", "email", "text", "company", "home", "shop", "cart", "menu", "search",
  "login", "account", "blog", "news", "press", "contact", "faq", "help", "support", "brands",
  "brand", "view", "click", "buy", "save", "sale", "day", "days", "week", "night", "new",
  "best", "free", "made", "uses", "use", "using", "first", "dibs", "results", "improvement",
  "radiance", "elasticity", "firmer", "dull", "tired", "smoothing", "revitalizing", "brightening",
]);

/** 성분명 한 조각(슬래시 동의어 중 하나)이 INCI 이름 형태인가. */
function looksLikeInciSegment(segment: string): boolean {
  const t = segment.trim();
  if (t.length < 2 || t.length > 90) return false;
  // 낱말 수 상한 — `Sodium Hyaluronate` 2, `Butyrospermum Parkii (Shea) Butter` 4.
  // 8 낱말을 넘는 성분명은 실무에서 거의 없고, 넘으면 문장일 가능성이 높다.
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  // 알파벳 또는 한글이 있어야 한다 (숫자·기호만인 조각은 성분이 아니다)
  if (!/[A-Za-z가-힣]/.test(t)) return false;
  // 세미콜론·콜론은 성분명에 쓰이지 않는다
  if (/[;:]/.test(t)) return false;
  // 마침표 뒤에 공백+대문자 = 문장 경계
  if (/\.\s+[A-Z]/.test(t)) return false;

  const lowerWords = words.map((w) => w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""));
  if (lowerWords.some((w) => FUNCTION_WORDS.has(w))) return false;
  if (words.length === 1 && NON_INCI_SINGLE_WORDS.has(lowerWords[0])) return false;

  return true;
}

/**
 * INCI 성분명으로 보이는가 — 형태만 본다. 사전 조회는 하지 않는다.
 *
 * **슬래시는 동의어 구분자다.** 한 성분을 여러 명명법으로 함께 적는다:
 *
 *   `MICROCRYSTALLINE WAX / CERA MICROCRISTALLINA / CIRE MICROCRISTALLINE`
 *   `EUPHORBIA CERIFERA (CANDELILLA) WAX / EUPHORBIA CERIFERA CERA / CIRE DE CANDELILLA`
 *
 * 이것을 한 덩어리로 세면 낱말이 12개가 되어 «문장» 으로 오판된다 (2026-07-30
 * 라네즈 립 슬리핑 마스크가 이 때문에 반려됐다). 조각별로 나눠서 본다.
 *
 * 슬래시가 성분명 **안에** 쓰이는 경우(`Caprylic/Capric Triglyceride`)도 조각으로
 * 나눠도 각 조각이 성분명 형태라 판정이 달라지지 않는다.
 */
function looksLikeInciToken(token: string): boolean {
  const segments = token
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return false;
  return segments.every(looksLikeInciSegment);
}

/**
 * 전성분을 항목으로 쪼갠다.
 *
 * **숫자 사이의 쉼표는 구분자가 아니다** — `1,2-Hexanediol` · `1,3-Butylene Glycol`
 * 은 성분명 하나다. 그냥 `,` 로 쪼개면 `1` 이라는 조각이 생겨 정상 목록이 반려된다.
 */
export function splitIngredientTokens(text: string): string[] {
  // 쪼개지 **않는** 경우는 «앞뒤가 모두 숫자인 쉼표» 뿐이다 — `1,2-Hexanediol` 안의 쉼표.
  // 앞 규칙 `,(?!\s*\d+\s*[,-])` 은 이름 **앞의** 쉼표까지 막아서
  // `Niacinamide, 1,2-Hexanediol` 이 한 토큰으로 붙었다.
  return String(text ?? "")
    .split(/(?<!\d),|,(?!\d)/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 목록에 **기제(base)** 성분이 하나라도 있는가. 없으면 성분표가 아니다.
 *
 * 물 기반만 요구하면 **무수(anhydrous) 제형을 오판한다.** 페이셜 오일은 전성분이
 * 전부 오일·에스터이고 물이 없다 — 2026-07-30 하루하루원더 «Black Rice Facial Oil»
 * (Oryza Sativa Bran Oil · Sunflower Seed Oil · Caprylic/Capric Triglyceride …)이
 * 정상인데 반려됐다. 파우더·밤도 같다.
 *
 * `\b` 는 `\w`(=[A-Za-z0-9_]) 기준이라 한글에는 경계가 잡히지 않는다. 한글은 따로 본다.
 */
function hasVehicleIngredient(text: string): boolean {
  return (
    // 수상(water-based)
    /\b(aqua|water|eau|glycerin|glycerine|butylene glycol|propanediol|pentylene glycol|dipropylene glycol|alcohol)\b/i.test(
      text
    ) ||
    // 유상·실리콘 (오일·밤)
    /\b(oil|butter|wax|cera|triglyceride|squalane|isononanoate|dimethicone|cyclomethicone|ester|esters)\b/i.test(
      text
    ) ||
    // 분말 (파우더·컴팩트)
    /\b(silica|talc|mica|starch|kaolin|boron nitride)\b/i.test(text) ||
    /(정제수|물|글리세린|부틸렌글라이콜|프로판다이올|다이메티콘|오일|왁스|버터|스쿠알란|실리카|마이카|탤크|전분)/.test(
      text
    )
  );
}

export type IngredientListVerdict =
  | { ok: true; tokens: string[] }
  | { ok: false; reason: string; sample?: string };

/**
 * @param raw 저장하려는 전성분 원문
 */
export function validateIngredientList(raw: string | null | undefined): IngredientListVerdict {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: false, reason: "빈 문자열" };
  if (text.length < 30) return { ok: false, reason: `너무 짧다 (${text.length}자)` };

  for (const { re, why } of HARD_REJECT_MARKERS) {
    const m = text.match(re);
    if (m) return { ok: false, reason: `${why} 포함`, sample: m[0] };
  }

  const lower = text.toLowerCase();
  for (const w of MARKETING_WORDS) {
    if (lower.includes(w)) return { ok: false, reason: "마케팅·UI 문구 포함", sample: w };
  }

  const tokens = splitIngredientTokens(text);
  if (tokens.length < 5) return { ok: false, reason: `쉼표 구분 항목이 ${tokens.length}개뿐` };

  const bad = tokens.filter((t) => !looksLikeInciToken(t));
  // 항목 하나라도 문장처럼 보이면 목록 전체를 의심한다 — 오염은 보통 목록의
  // 앞이나 뒤에 문장 한두 개가 붙는 형태로 들어온다.
  if (bad.length > 0) {
    return {
      ok: false,
      reason: `성분명 형태가 아닌 항목 ${bad.length}개`,
      sample: bad[0].slice(0, 60),
    };
  }

  if (!hasVehicleIngredient(text)) return { ok: false, reason: "용제·기제 성분이 하나도 없다" };

  return { ok: true, tokens };
}

/**
 * 목록 **뒤에 붙은 페이지 문구를 잘라낸다.**
 *
 * 실제 원문(2026-07-30 COSRX 비타민C 23 세럼):
 *
 *   `... Glycyrrhiza Glabra (Licorice) Root Extract, Beta-Carotene 🤖 Still not sure?
 *    Ask our AI Shopping Consultant. ... BUSTLE BEAUTY AWARDS WINNER ... 2025, on 20
 *    adult participants. WHO IS IT FOR? ...`
 *
 * 전성분은 `Beta-Carotene` 까지 **완전하다.** 라벨 뒤 3000자를 그대로 쓰기 때문에
 * 목록이 끝난 뒤의 본문이 함께 들어온다. `STOP_RE` 로 잡으려 해도 브랜드마다
 * 이어지는 문구가 달라 낱말 목록으로는 끝이 없다. 그래서 **구조로 끊는다** —
 * 성분명 형태인 항목이 이어지는 구간까지만 남긴다.
 *
 * ## 왜 조심해야 하는가
 *
 * 전성분은 함량 내림차순이라 **향료·알레르겐이 목록 끝에 온다**(Limonene ·
 * Linalool · Fragrance). 잘못 자르면 알레르기 필터가 볼 성분이 사라지는데, 그건
 * "안전하다" 는 잘못된 판정으로 이어진다 — 2026-07-27 에 고친 바로 그 결함이다.
 *
 * 그래서 자르기 전에 **꼬리 전체가 진짜 쓰레기인지** 확인한다. 꼬리에 성분명
 * 형태인 항목이 30% 넘게 있으면 경계가 애매하다는 뜻이므로 **자르지 않고 반려**해서
 * 사람이 보게 한다. 성분 형태 판정이 어쩌다 틀려 목록 중간에서 끊기는 경우가
 * 이 조건에 걸린다 — 꼬리가 대부분 성분명이기 때문이다.
 */
const TAIL_JUNK_RATIO_MAX = 0.3;

/**
 * 성분 목록이 **여기서 확실히 끝났다**고 볼 수 있는 표시.
 *
 * 항목 단위(쉼표)로만 자르면 마지막 성분을 잃는다 — 실제 원문은
 * `..., Beta-Carotene 🤖 Still not sure? Ask our AI...` 처럼 **쉼표 없이 붙는다.**
 * 그래서 항목으로 쪼개기 전에 문자 단위로 먼저 끊는다.
 *
 * `:` 는 넣지 않는다. 메이크업 전성분의 `May Contain (+/-): CI 77491` 은 뒤에 오는
 * 색소가 **실제 성분**이라, 여기서 끊으면 조용히 사라진다. 그 경우는 `may` 가
 * 기능어라 항목 판정에서 걸려 «경계 애매» 로 반려되고 사람이 본다 — 그게 맞다.
 */
const JUNK_MARKERS: ReadonlyArray<RegExp> = [
  // 이모지 — 본문·배지에만 쓰인다
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
  /&[a-z]{2,8};|&#\d+;/i,
  /[?!]/,
  /#[A-Za-z]/,
  /:\/\//,
  // 관측된 UI·리뷰 위젯 문구 (2026-07-30 21건 실측)
  /\boverall\s+rating\b/i,
  /\bstill\s+not\s+sure\b/i,
  /\bwrite\s+a\s+review\b/i,
  /\bcustomer\s+reviews?\b/i,
  /\byou\s+may\s+also\s+like\b/i,
  /\brelated\s+products?\b/i,
  /\bwelcome\s+offer\b/i,
  /\badd\s+to\s+cart\b/i,
  /\bshop\s+now\b/i,
  /\b(?:learn|read)\s+more\b/i,
  /\bhow\s+to\s+use\b/i,
  /\babout\s+us\b/i,
  /\bsign\s+up\b/i,
  /\bbased\s+on\s+a\s+\d+-week\b/i,
];

/** 목록 끝 표시 중 가장 앞에 나오는 것에서 문자열을 끊는다. */
function cutAtJunkMarker(text: string): string {
  let cut = text.length;
  for (const re of JUNK_MARKERS) {
    const m = text.match(re);
    if (m?.index != null && m.index < cut) cut = m.index;
  }
  return text.slice(0, cut).replace(/[\s,;]+$/, "").trim();
}

export type SanitizeResult =
  | {
      ok: true;
      text: string;
      tokens: string[];
      /** 항목 단위로 잘라낸 꼬리 항목 수 */
      droppedTailTokens: number;
      /** 목록 끝 표시에서 문자 단위로 끊었는가 */
      cutAtMarker: boolean;
    }
  | { ok: false; reason: string; sample?: string };

/**
 * 제형·호수별 목록이 **한 문자열에 이어 붙은 것**을 구분자로 가른다.
 *
 * 색조·립 제품은 호수마다 전성분이 다르고, 페이지에서는 라벨을 붙여 나열한다:
 *
 *   `… VITIS VINIFERA (GRAPE) JUICE GRAPEFRUIT: DIISOSTEARYL MALATE, …`
 *   `… Tocopherol Compact: Mica, Talc, …`
 *
 * 라벨의 콜론에서 **끊으면** 뒤쪽 호수의 성분이 통째로 사라진다. 전성분은 함량
 * 내림차순이라 향료·알레르겐이 뒤에 몰려 있어, 버리는 건 정확히 잘못된 방향이다.
 * 그래서 **쉼표로 바꿔 이어 붙인다** — 모든 호수의 성분을 합집합으로 본다.
 * 과다 포함이지만 알레르겐 판정에서는 안전한 쪽이다.
 *
 * 콜론은 INCI 이름에 쓰이지 않으므로 라벨 표시로 봐도 된다. 다만 **낱말 3개 이내**
 * 짧은 라벨만 본다 — 긴 것은 설명 문장이라 라벨이 아니다.
 *
 * 메이크업의 `May Contain (+/-): CI 77491` 도 이 규칙에 걸려 색소가 살아남는다.
 */
function splitVariantLabels(text: string): string {
  return text.replace(
    /(^|[,\s])((?:[A-Za-z0-9'’&+.-]+[ ]){0,2}[A-Za-z0-9'’&+.()/-]+)\s*:\s+(?=[A-Za-z가-힣])/g,
    (whole, lead: string, label: string) => {
      // 라벨 안에 쉼표가 있으면 라벨이 아니라 목록이다 — 건드리지 않는다.
      if (label.includes(",")) return whole;
      return `${lead === "," ? "," : lead}, `;
    }
  );
}

export function sanitizeIngredientList(raw: string | null | undefined): SanitizeResult {
  const original = String(raw ?? "").trim();
  const text = cutAtJunkMarker(splitVariantLabels(original));
  if (!text) return { ok: false, reason: "빈 문자열" };
  const cutAtMarker = text.length < original.length;

  const tokens = splitIngredientTokens(text);
  const cut = tokens.findIndex((t) => !looksLikeInciToken(t));

  // 전부 성분명 형태 — 자를 것이 없다.
  if (cut < 0) {
    const v = validateIngredientList(text);
    return v.ok ? { ok: true, text, tokens: v.tokens, droppedTailTokens: 0, cutAtMarker } : v;
  }

  const head = tokens.slice(0, cut);
  const tail = tokens.slice(cut);

  // 앞머리부터 성분이 아니면 목록 자체를 잘못 잡은 것이다 (JS 배열 리터럴을 통째로
  // 집어온 사례가 있었다 — `"works","skin","looks","bottle",...`).
  if (head.length < 5) {
    return {
      ok: false,
      reason: `목록 앞부분부터 성분명이 아니다 (성분 형태 ${head.length}개뿐)`,
      sample: tokens[cut]?.slice(0, 60),
    };
  }

  const shapedInTail = tail.filter((t) => looksLikeInciToken(t)).length;
  if (shapedInTail / tail.length > TAIL_JUNK_RATIO_MAX) {
    return {
      ok: false,
      reason: `목록 끝 경계가 애매하다 (잘린 뒤에도 성분 형태 ${shapedInTail}/${tail.length}개)`,
      sample: tail[0]?.slice(0, 60),
    };
  }

  const headText = head.join(", ");
  const v = validateIngredientList(headText);
  return v.ok
    ? { ok: true, text: headText, tokens: v.tokens, droppedTailTokens: tail.length, cutAtMarker }
    : v;
}

/**
 * Extract INCI only from explicitly labeled sections.
 * Never invent ingredients; reject marketing blurbs without INCI markers.
 */

import { stripHtml } from "@/lib/catalog/automation/ingredientParser";

const LABEL_RE =
  /(?:전\s*성\s*분(?:\s*(?:목록|정보))?|모든\s*성분|성분\s*전체|full\s+ingredients?|ingredients?(?:\s*(?:list|full\s+list))?|inci(?:\s*list)?)\s*[:：\-]?\s*/gi;

const STOP_RE =
  /(?:주의\s*사항|사용\s*방법|사용법|효능|효과|제품\s*특징|how\s*to\s*use|directions?|caution|warning|shipping|returns?|배송|교환|환불|리뷰|review|description|제품\s*설명|용량|사용기한)\s*[:：]?/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

/**
 * 성분명이 아닌 것에만 나오는 낱말. 네비게이션·판촉 문구를 걸러낸다.
 */
const NOT_INGREDIENT_WORDS =
  /\b(?:the|your|our|you|we|is|are|was|helps?|provides?|improves?|needs?|value|shop|home|menu|cart|login|sale|best|free|type|size|benefits?|nourish|clearance|merch|travel)\b|스킨\s*타입|장바구니|로그인|더보기|숨기기|바로가기/i;

/** 성분명은 짧고, 문장부호가 없고, 단어 수가 적다. */
function looksLikeIngredientToken(part: string): boolean {
  if (part.length > 60) return false;
  // 성분명에 느낌표·물음표는 없다. 마침표는 «Alcohol Denat.» 처럼 쓰이므로 뺀다.
  if (/[!?]/.test(part)) return false;
  if (NOT_INGREDIENT_WORDS.test(part)) return false;
  // 6단어를 넘는 성분명은 사실상 없다 («Sodium Cocoyl Amino Acids» = 4).
  if (part.split(/\s+/).filter(Boolean).length > 6) return false;
  return /[A-Za-z가-힣]/.test(part);
}

function splitParts(text: string): string[] {
  return text
    .split(/[,;،·•|/\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2 && p.length <= 140);
}

/**
 * 이 구간이 전성분 목록일 «가능성 점수». 0 이면 아니다.
 *
 * 예전 규칙은 `hasVehicle || parts.length >= 8` 이었다. 그런데 네비게이션 메뉴는
 * 줄바꿈이 많아 토큰이 쉽게 8개를 넘는다. 그래서 2026-07-29 Production 반영에서
 * 24건 중 18건에 «Body From Skin to Hair Care Body Care Hair» 같은 문구가 성분으로
 * 들어갔다(DASHBOARD §32). 이제 **용매 토큰과 성분다움 비율을 둘 다** 요구한다.
 */
function inciListScore(text: string): number {
  const parts = splitParts(text);
  if (parts.length < 3) return 0;

  const latinOrKorean = parts.filter((p) => /[A-Za-z가-힣]/.test(p)).length;
  if (latinOrKorean / parts.length < 0.8) return 0;

  // 전성분은 거의 언제나 용매·기제로 시작한다. 가장 강한 신호다.
  const joined = text.toLowerCase();
  const hasVehicle =
    /\b(aqua|water|glycerin|glycerol|butylene\s+glycol|propanediol|dipropylene\s+glycol|caprylic|alcohol\s+denat|ethanol)\b|정제수|글리세린|부틸렌글라이콜|프로판다이올|변성알코올/i.test(
      joined
    );
  if (!hasVehicle) return 0;

  // 목록 전체가 성분처럼 보여야 한다. 섞여 있으면 잘못 잡은 것이다.
  const ratio = parts.filter(looksLikeIngredientToken).length / parts.length;
  if (ratio < 0.85) return 0;

  // **첫 항목이 성분이 아니면 구간을 잘못 잡은 것이다.** 전성분은 함량 내림차순이라
  // 첫 자리는 반드시 성분이다. 설명 문단 한가운데를 집으면 여기가 문장으로 시작한다:
  //
  //   «improves hydration, firmness GINSENG CAFFEINETM COMPLEX : Reduces, GLYCERIN, …»
  //   «Green Tea Water + Encapsulated Hyaluronic Acid: Amplified hydration, …»
  //
  // 같은 페이지에 제대로 된 구간이 따로 있으면 그쪽이 이기도록 점수를 깎는다.
  // 0 으로 만들지는 않는다 — 다른 후보가 없을 때는 이거라도 사람이 보는 편이 낫다.
  return looksLikeIngredientToken(parts[0]) ? ratio : ratio * 0.5;
}

/**
 * 목록 앞에 붙는 **UI 잡음**을 걷어낸다.
 *
 * 아코디언·탭으로 만든 페이지에서는 라벨 뒤에 닫기 버튼(`×`)이나 소제목이
 * 그대로 딸려 온다. 2026-07-29 실측에서 이런 것들이 첫 성분 자리를 차지했다:
 *
 *   "&times; Full Ingredients Water, Caprylic/Capric..."   -> "Water, Caprylic..."
 *   "List: Water, Butylene Glycol..."                      -> "Water, Butylene..."
 *   "PEACH ICED TEA: DIISOSTEARYL MALATE..."               -> "DIISOSTEARYL..."
 *
 * 마지막 형태(제형·호수 라벨)는 §35.7 이 이미 본문에서 다루는 규칙과 같은
 * 성격이라 여기서도 같은 방식으로 벗긴다. 성분 자체는 지우지 않는다 —
 * 콜론 앞의 «라벨» 만 떼어낸다.
 */
function stripLeadingNoise(raw: string): string {
  let out = raw.trim();
  // 1) 닫기 버튼·엔티티
  out = out.replace(/^(?:&times;|&#215;|×|✕|✖)\s*/i, "").trim();
  // 2) 소제목: Full Ingredients / Ingredients List / List
  out = out
    .replace(/^(?:full\s+ingredients?|ingredients?\s*list|list|전\s*성\s*분)\s*[:：]?\s*/i, "")
    .trim();
  // 3) 다시 한 번 닫기 버튼 (순서가 뒤바뀐 경우)
  out = out.replace(/^(?:&times;|&#215;|×)\s*/i, "").trim();
  // 4) 앞머리 라벨 «AAA BBB :» — 콜론까지가 40자 이내이고 쉼표가 없을 때만.
  //    성분명에도 콜론이 드물게 쓰이므로 짧고 쉼표 없는 경우로 좁힌다.
  const labeled = out.match(/^([^,:]{2,40})\s*[:：]\s+([\s\S]+)$/);
  if (labeled) out = labeled[2].trim();
  return out;
}

/**
 * 목록 **끝**에 붙는 UI 낱말을 걷어낸다.
 *
 * 아코디언 뒤에 «DETAILS» · «MORE» 같은 버튼 글자가 마지막 성분에 그대로 붙는다.
 * 2026-07-30 실측: `Ethyl Hexanediol DETAILS` · `Disodium EDTA DETAILS` ·
 * `Glutathione DETAILS`. 성분 자체는 사전에 있는데 이 꼬리 때문에 미매칭이 났다.
 *
 * 성분명이 이 낱말로 끝나는 경우는 없으므로, **낱말 단위로 끝에 붙었을 때만** 뗀다.
 */
const TRAILING_UI_WORDS =
  /\s+(?:DETAILS?|MORE|CLOSE|VIEW|SHOP\s+NOW|LEARN\s+MORE|READ\s+MORE|더\s*보기|자세히\s*보기|닫기)\s*$/i;

function stripTrailingUiWords(raw: string): string {
  let out = raw.trim();
  // 여러 개가 겹쳐 붙는 경우가 있어 더 이상 안 줄어들 때까지 반복한다.
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(TRAILING_UI_WORDS, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Returns raw ingredient text after a clear label, or null. */
export function extractLabeledIngredientsRaw(
  html: string
): { raw: string; label: string } | null {
  const plain = decodeHtmlEntities(stripHtml(html))
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n");
  LABEL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let best: { raw: string; label: string } | null = null;

  let bestScore = 0;
  while ((match = LABEL_RE.exec(plain))) {
    const label = match[0].trim();
    const start = match.index + match[0].length;
    // 창이 8000자면 라벨 뒤 페이지 전체를 삼킨다. 전성분은 길어야 3000자 안쪽이다
    // (토큰 100개 × 평균 25자 + 구분자).
    const rest = plain.slice(start, start + 3000);
    const stopIdx = rest.search(STOP_RE);
    const chunk = (stopIdx >= 0 ? rest.slice(0, stopIdx) : rest)
      .replace(/[\t ]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
    const score = inciListScore(chunk);
    if (score === 0) continue;
    // 예전에는 «가장 긴 것» 을 골랐다. 길수록 페이지 문구를 삼켰을 가능성이 커서
    // 거꾸로였다. 이제 성분다움 점수가 높은 쪽을 고르고, 같으면 긴 쪽을 쓴다.
    if (score > bestScore || (score === bestScore && best && chunk.length > best.raw.length)) {
      bestScore = score;
      best = { raw: stripTrailingUiWords(stripLeadingNoise(chunk)), label };
    }
  }
  return best;
}

export function extractOpenGraph(html: string): {
  title: string | null;
  image: string | null;
  description: string | null;
  siteName: string | null;
} {
  const pick = (prop: string): string | null => {
    const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
        "i"
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtmlEntities(match[1].trim());
    }
    return null;
  };
  return {
    title: pick("og:title"),
    image: pick("og:image") ?? pick("og:image:secure_url"),
    description: pick("og:description"),
    siteName: pick("og:site_name"),
  };
}

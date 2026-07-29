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

  return ratio;
}

function looksLikeInciList(text: string): boolean {
  return inciListScore(text) > 0;
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
      best = { raw: chunk, label };
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

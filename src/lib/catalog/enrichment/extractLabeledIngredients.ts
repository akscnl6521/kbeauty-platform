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

function looksLikeInciList(text: string): boolean {
  const parts = text
    .split(/[,;،·•|/\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2 && p.length <= 140);
  if (parts.length < 3) return false;

  const latinOrKorean = parts.filter((p) => /[A-Za-z가-힣]/.test(p)).length;
  if (latinOrKorean / parts.length < 0.8) return false;

  const joined = text.toLowerCase();
  const hasVehicle =
    /\b(aqua|water|glycerin|butylene\s+glycol|propanediol|caprylic)\b|정제수|글리세린|부틸렌글라이콜|프로판다이올/i.test(
      joined
    );
  const marketingOnly =
    /(?:helps?|improves?|brighten|soothing care|피부에 도움|진정 케어|보습 케어)/i.test(
      joined
    ) && parts.length < 8;

  return !marketingOnly && (hasVehicle || parts.length >= 8);
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

  while ((match = LABEL_RE.exec(plain))) {
    const label = match[0].trim();
    const start = match.index + match[0].length;
    const rest = plain.slice(start, start + 8000);
    const stopIdx = rest.search(STOP_RE);
    const chunk = (stopIdx >= 0 ? rest.slice(0, stopIdx) : rest)
      .replace(/[\t ]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
    if (!looksLikeInciList(chunk)) continue;
    if (!best || chunk.length > best.raw.length) {
      best = { raw: chunk, label };
    }
  }
  return best;
}

export function extractOpenGraph(html: string): {
  title: string | null;
  image: string | null;
  description: string | null;
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
  };
}

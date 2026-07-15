/**
 * Extract INCI only from explicitly labeled sections.
 * Never invent ingredients; reject marketing blurbs without INCI markers.
 */

import { stripHtml } from "@/lib/catalog/automation/ingredientParser";

const LABEL_RE =
  /(?:전\s*성\s*분|전성분\s*목록|ingredients?(?:\s*list)?|inci(?:\s*list)?)\s*[:：\-]?\s*/gi;

const STOP_RE =
  /(?:주의\s*사항|사용\s*방법|how\s*to\s*use|directions?|caution|경고|배송|교환|환불|리뷰|review|description|제품\s*설명)\s*[:：]?/i;

function looksLikeInciList(text: string): boolean {
  const parts = text
    .split(/[,;،·•|/]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length < 3) return false;
  const latin = parts.filter((p) => /[A-Za-z]/.test(p)).length;
  if (latin / parts.length < 0.5) return false;
  // Prefer lists that include water or common base vehicle
  const joined = text.toLowerCase();
  const hasVehicle =
    /\b(aqua|water|정제수|glycerin|butylene\s+glycol|caprylic)\b/i.test(
      joined
    );
  return hasVehicle || parts.length >= 8;
}

/**
 * Returns raw ingredient text after a clear label, or null.
 */
export function extractLabeledIngredientsRaw(
  html: string
): { raw: string; label: string } | null {
  const plain = stripHtml(html).replace(/\u00a0/g, " ");
  LABEL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let best: { raw: string; label: string } | null = null;

  while ((match = LABEL_RE.exec(plain))) {
    const label = match[0].trim();
    const start = match.index + match[0].length;
    const rest = plain.slice(start, start + 4000);
    const stopIdx = rest.search(STOP_RE);
    const chunk = (stopIdx >= 0 ? rest.slice(0, stopIdx) : rest)
      .replace(/\s+/g, " ")
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
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i"
    );
    const m = html.match(re) || html.match(re2);
    return m?.[1]?.trim() || null;
  };
  return {
    title: pick("og:title"),
    image: pick("og:image"),
    description: pick("og:description"),
  };
}

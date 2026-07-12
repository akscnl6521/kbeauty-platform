import { INGREDIENT_ALIAS_GROUPS } from "./ingredientAliases";
import { normalizeIngredientKey, toCanonical } from "./normalizeIngredient";

export type IngredientDisplayLocale = "en" | "ja" | "ko";

function hasHangul(s: string): boolean {
  return /[\uAC00-\uD7A3]/.test(s);
}

function hasKanaOrKanji(s: string): boolean {
  return /[\u3040-\u30FF\u4E00-\u9FFF]/.test(s);
}

function pickLocalizedLabel(
  group: readonly string[],
  locale: IngredientDisplayLocale
): string {
  const en = group[0] ?? "";
  if (locale === "en") return en;

  if (locale === "ko") {
    const ko = group.find((a) => hasHangul(a));
    // 한국어 UI: 한글 표준명 우선, 없으면 영문 INCI (일본어 표기 사용 금지)
    return ko ?? en;
  }

  const ja = group.find((a) => hasKanaOrKanji(a) && !hasHangul(a));
  return ja ?? en;
}

/** canonical(normalizeKey) → locale 표시명 */
let displayMaps: Record<
  IngredientDisplayLocale,
  Map<string, string>
> | null = null;

function buildDisplayMaps(): Record<
  IngredientDisplayLocale,
  Map<string, string>
> {
  const en = new Map<string, string>();
  const ko = new Map<string, string>();
  const ja = new Map<string, string>();

  for (const group of INGREDIENT_ALIAS_GROUPS) {
    if (group.length === 0) continue;
    const canonical = normalizeIngredientKey(group[0]);
    if (!canonical) continue;
    en.set(canonical, pickLocalizedLabel(group, "en"));
    ko.set(canonical, pickLocalizedLabel(group, "ko"));
    ja.set(canonical, pickLocalizedLabel(group, "ja"));
  }

  return { en, ko, ja };
}

function getDisplayMaps() {
  if (!displayMaps) displayMaps = buildDisplayMaps();
  return displayMaps;
}

/**
 * 성분 원문을 로케일별 표준 표시명으로 통일한다.
 * - ko: 한글 표준명 (없으면 영문 INCI). 일본어 표기는 노출하지 않음.
 * - ja: 일본어 표준명 (없으면 영문 INCI)
 * - en: 영문 INCI
 */
export function displayIngredientName(
  raw: string,
  locale: IngredientDisplayLocale = "en"
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const canonical = toCanonical(trimmed);
  const maps = getDisplayMaps();
  const mapped = maps[locale].get(canonical);
  if (mapped) return mapped;

  // 매핑 없는 경우: 한국어 UI에서 일본어 문자열이 오면 그대로 두지 않고
  // 원문이 일본어처럼 보이면 영문 canonical 키를 타이틀케이스로 근사 표시
  if (locale === "ko" && hasKanaOrKanji(trimmed) && !hasHangul(trimmed)) {
    return canonical
      .split(" ")
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  return trimmed;
}

export function displayIngredientNames(
  names: string[],
  locale: IngredientDisplayLocale = "en"
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const label = displayIngredientName(name, locale);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

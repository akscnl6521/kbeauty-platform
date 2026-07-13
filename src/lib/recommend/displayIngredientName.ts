import {
  INGREDIENT_DISPLAY_BY_CANONICAL,
  INGREDIENT_DISPLAY_BY_RAW,
  ingredientDisplayLookupKey,
  pickIngredientDisplayLabel,
  type IngredientDisplayLocale,
} from "./ingredientDisplayLabels";
import { INGREDIENT_ALIAS_GROUPS } from "./ingredientAliases";
import { normalizeIngredientKey, toCanonical } from "./normalizeIngredient";

export type { IngredientDisplayLocale };

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
 * - 표시 사전 우선 (매칭 alias와 분리)
 * - ko: 한글 표준명 (없으면 영문 INCI). 일본어 표기는 노출하지 않음.
 * - ja: 일본어 표준명 (없으면 영문 INCI)
 * - en: 영문 INCI
 * 매칭 로직에는 이 함수 결과를 넣지 말 것.
 */
export function displayIngredientName(
  raw: string,
  locale: IngredientDisplayLocale = "en"
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // 1) 원문 표시 사전 (괄호 표기 등)
  const rawKey = ingredientDisplayLookupKey(trimmed);
  const fromRaw = pickIngredientDisplayLabel(
    INGREDIENT_DISPLAY_BY_RAW[rawKey],
    locale
  );
  if (fromRaw) return fromRaw;

  const canonical = toCanonical(trimmed);

  // 2) canonical 선호 표시 (자연스러운 KO)
  if (canonical) {
    const fromCanonPreferred = pickIngredientDisplayLabel(
      INGREDIENT_DISPLAY_BY_CANONICAL[canonical],
      locale
    );
    if (fromCanonPreferred) return fromCanonPreferred;
  }

  // 3) 기존 alias 그룹 기반 맵
  const maps = getDisplayMaps();
  if (canonical) {
    const mapped = maps[locale].get(canonical);
    if (mapped) return mapped;
  }

  // 매핑 없는 경우: 한국어 UI에서 일본어 문자열이 오면 그대로 두지 않고
  // 원문이 일본어처럼 보이면 영문 canonical 키를 타이틀케이스로 근사 표시
  if (locale === "ko" && hasKanaOrKanji(trimmed) && !hasHangul(trimmed)) {
    return (canonical || rawKey)
      .split(" ")
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  // 알 수 없는 성분 → 원문 fallback (가짜 번역 금지)
  return trimmed;
}

/** 권장 별칭 — 표시 직전 locale label만 변환 */
export function getIngredientDisplayName(
  name: string,
  locale: IngredientDisplayLocale = "en"
): string {
  return displayIngredientName(name, locale);
}

/** 표시용 canonical 키 (매칭 로직과 동일 toCanonical — 배열/점수 변경 없음) */
export function getIngredientCanonicalKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  // "Centella Asiatica (Cica)"처럼 괄호 별칭이 붙은 표기는
  // 괄호를 제거한 기본명 canonical을 우선해 동일 성분으로 묶는다.
  const withoutParen = trimmed
    .replace(/\s*[([{（][^)\]}）]*[)\]}）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const keyFull = toCanonical(trimmed);
  const keyBase =
    withoutParen && withoutParen !== trimmed ? toCanonical(withoutParen) : "";

  if (keyBase && keyFull && keyBase !== keyFull) {
    if (keyFull.startsWith(keyBase) || keyFull.includes(keyBase)) {
      return keyBase;
    }
  }

  return keyFull || keyBase || ingredientDisplayLookupKey(trimmed);
}

/**
 * 더 구체적인 표시 라벨 우선 (괄호 부가명·더 긴 표기).
 * 서로 다른 성분을 합치지 않는다 — 동일 canonical 안에서만 비교.
 */
export function isMoreSpecificIngredientLabel(
  candidate: string,
  previous: string
): boolean {
  const a = candidate.trim();
  const b = previous.trim();
  if (!a) return false;
  if (!b) return true;
  const aParen = a.includes("(") || a.includes("（");
  const bParen = b.includes("(") || b.includes("（");
  if (aParen !== bParen) return aParen;
  return a.length > b.length;
}

/**
 * 화면 표시용 성분명 목록.
 * 동일 canonical은 하나로 합치고, 구체 라벨을 남긴다.
 * matchedIngredients / score 계산에는 쓰지 말 것.
 */
export function displayIngredientNames(
  names: string[],
  locale: IngredientDisplayLocale = "en"
): string[] {
  const byCanonical = new Map<string, string>();
  for (const name of names) {
    const label = displayIngredientName(name, locale);
    if (!label) continue;
    const canonicalKey = getIngredientCanonicalKey(name);
    const key = canonicalKey || label.toLowerCase();
    const previous = byCanonical.get(key);
    if (!previous || isMoreSpecificIngredientLabel(label, previous)) {
      byCanonical.set(key, label);
    }
  }
  return [...byCanonical.values()];
}

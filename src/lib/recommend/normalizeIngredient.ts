/**
 * 성분명 정규화·비교 유틸 (Phase 2).
 * 추천 성분과 제품 성분 표기 차이를 줄이기 위한 헬퍼.
 */

/** 비교용 키: 소문자, 공백/하이픈/특수문자 제거 */
export function normalizeIngredientKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[%0-9]/g, " ")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/gi, "")
    .trim();
}

/**
 * 제품 성분 필드를 문자열 배열로 통일.
 * string[] | string | null | undefined 모두 허용.
 */
export function coerceIngredientList(
  value: string[] | string | null | undefined
): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    // JSON 배열 문자열 또는 쉼표 구분
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
            .filter(Boolean);
        }
      } catch {
        // fall through
      }
    }
    return trimmed
      .split(/[,;/|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * 후보 목록에서 needle과 매칭되는 원본 표기를 찾는다.
 * - 정규화 키가 같으면 매칭
 * - 한쪽이 다른 쪽을 포함하면 매칭 (예: "niacinamide" ⊂ "niacinamideamide" 방지 위해 최소 길이 가드)
 */
export function findMatchingIngredient(
  needle: string,
  haystack: string[]
): string | null {
  const needleKey = normalizeIngredientKey(needle);
  if (!needleKey || needleKey.length < 2) return null;

  for (const item of haystack) {
    const itemKey = normalizeIngredientKey(item);
    if (!itemKey) continue;
    if (itemKey === needleKey) return item;
    // 짧은 키가 긴 키에 포함될 때만 허용 (오탐 완화)
    const shorter = needleKey.length <= itemKey.length ? needleKey : itemKey;
    const longer = needleKey.length <= itemKey.length ? itemKey : needleKey;
    if (shorter.length >= 4 && longer.includes(shorter)) {
      return item;
    }
  }
  return null;
}

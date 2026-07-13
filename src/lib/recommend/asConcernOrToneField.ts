/**
 * skin_concern / skin_tone — DB text[] 또는 단일 문자열 호환.
 * 배열이면 배열 유지, 단일 문자열이면 문자열 유지, 그 외 null.
 * 의미를 잃지 않도록 배열을 하나의 문자열로 합치지 않는다.
 */
export function asConcernOrToneField(
  value: unknown
): string | string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const items = value
      .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

/**
 * 성분 다국어 동의어 → 정규화 비교용 그룹.
 * 제품명을 하드코딩하지 않고, 성분명 표기 차이만 흡수한다.
 */

/** 각 배열 = 동일 성분. 첫 영문 표기를 캐논컬 라벨로 사용 */
export const INGREDIENT_ALIAS_GROUPS: readonly (readonly string[])[] = [
  [
    "Centella Asiatica",
    "Centella",
    "Cica",
    "Madecassoside",
    "Asiaticoside",
    "센텔라 아시아티카",
    "센텔라",
    "병풀",
    "시카",
    "마데카소사이드",
    "ツボクサ",
    "センテラ",
  ],
  [
    "Panthenol",
    "D-Panthenol",
    "Dexpanthenol",
    "Provitamin B5",
    "Vitamin B5",
    "판테놀",
    "덱스판테놀",
    "프로비타민 B5",
    "パンテノール",
  ],
  [
    "Ceramide",
    "Ceramides",
    "Ceramide NP",
    "Ceramide AP",
    "Ceramide EOP",
    "세라마이드",
    "セラミド",
  ],
  [
    "Hyaluronic Acid",
    "Sodium Hyaluronate",
    "HA",
    "히알루론산",
    "히알루론산나트륨",
    "ヒアルロン酸",
    "ヒアルロン酸ナトリウム",
  ],
  [
    "Niacinamide",
    "Vitamin B3",
    "니아신아마이드",
    "나이아신아마이드",
    "ニコチン酸アミド",
    "ナイアシンアミド",
  ],
  [
    "Retinol",
    "Retinal",
    "Retinaldehyde",
    "레티놀",
    "레티날",
    "レチノール",
  ],
  [
    "Salicylic Acid",
    "BHA",
    "Beta Hydroxy Acid",
    "살리실산",
    "サリチル酸",
  ],
  [
    "Glycolic Acid",
    "AHA",
    "Alpha Hydroxy Acid",
    "글리콜산",
    "グリコール酸",
  ],
  [
    "Tea Tree",
    "Melaleuca",
    "티트리",
    "ティーツリー",
  ],
  [
    "Snail Mucin",
    "Snail Secretion Filtrate",
    "달팽이점액",
    "スネイルムチン",
  ],
  // 회피 성분 계열
  [
    "Alcohol",
    "Alcohol Denat",
    "Denatured Alcohol",
    "Ethanol",
    "SD Alcohol",
    "고함량 알코올",
    "변성알코올",
    "에탄올",
    "アルコール",
  ],
  [
    "Fragrance",
    "Parfum",
    "Perfume",
    "강한 향료",
    "향료",
    "香料",
    "フレグランス",
  ],
] as const;

/** 정규화 키 → 캐논컬 키 (그룹 대표 영문의 정규화형) */
let aliasLookup: Map<string, string> | null = null;

function buildAliasLookup(
  normalizeKey: (s: string) => string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of INGREDIENT_ALIAS_GROUPS) {
    if (group.length === 0) continue;
    const canonical = normalizeKey(group[0]);
    if (!canonical) continue;
    for (const alias of group) {
      const key = normalizeKey(alias);
      if (key) map.set(key, canonical);
    }
  }
  return map;
}

/**
 * 성분 문자열을 동의어 그룹의 캐논컬 키로 변환.
 * 그룹에 없으면 자기 정규화 키를 반환.
 */
export function toCanonicalIngredientKey(
  name: string,
  normalizeKey: (s: string) => string
): string {
  if (!aliasLookup) {
    aliasLookup = buildAliasLookup(normalizeKey);
  }
  const key = normalizeKey(name);
  if (!key) return "";
  return aliasLookup.get(key) ?? key;
}

/**
 * 매칭용 키 집합: 원문 정규화 + 캐논컬 + (캐논컬에 매핑된 모든 별칭 키는 비교 시 캐논컬로 통일되므로 원문·캐논컬이면 충분)
 */
export function expandIngredientMatchKeys(
  name: string,
  normalizeKey: (s: string) => string
): Set<string> {
  const keys = new Set<string>();
  const raw = normalizeKey(name);
  if (raw) keys.add(raw);
  const canonical = toCanonicalIngredientKey(name, normalizeKey);
  if (canonical) keys.add(canonical);
  return keys;
}

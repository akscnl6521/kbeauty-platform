/**
 * 피부 고민(KO/EN) → 캐논컬 키.
 * 성분 matchedIngredients를 가짜로 만들지 않고, score 고민 보너스에만 사용한다.
 */

const CONCERN_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ["dryness", "dry", "dehydrated", "건조", "건성", "수분부족", "乾燥"],
  [
    "antiaging",
    "anti-aging",
    "aging",
    "wrinkle",
    "elasticity",
    "firmness",
    "노화방지",
    "주름",
    "탄력",
    "エイジング",
  ],
  ["redness", "flush", "붉은기", "홍조", "赤み"],
  ["acne", "breakout", "pimple", "여드름", "트러블", "ニキビ"],
  [
    "sensitivity",
    "sensitive",
    "irritation",
    "민감",
    "민감성",
    "자극",
    "敏感",
  ],
  ["dullness", "dull", "tone", "칙기", "칙음", "くすみ"],
];

function normalizeConcernToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\uac00-\ud7af\u3040-\u30ff\u3400-\u9fff]+/gi, "");
}

const CONCERN_LOOKUP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of CONCERN_ALIAS_GROUPS) {
    const canonical = normalizeConcernToken(group[0] ?? "");
    if (!canonical) continue;
    for (const alias of group) {
      const key = normalizeConcernToken(alias);
      if (key) map.set(key, canonical);
    }
  }
  return map;
})();

/** 고민 라벨 → 캐논컬 (매칭 실패 시 정규화 토큰, 빈 입력이면 "") */
export function toCanonicalConcern(label: string): string {
  const key = normalizeConcernToken(label);
  if (!key) return "";
  return CONCERN_LOOKUP.get(key) ?? key;
}

/**
 * 표시 전용 성분명 사전.
 * 매칭용 alias/canonical 과 분리 — 이 파일 변경은 score·matchedIngredients 에 영향 없음.
 */

export type IngredientDisplayLocale = "en" | "ja" | "ko";

export type IngredientDisplayLabels = {
  en?: string;
  ko: string;
  ja?: string;
};

/**
 * lookup key = trim → NFKC → lower → 공백 정규화.
 * 괄호·표기 변형을 매칭 로직에 넣지 않고 표시만 덮어쓴다.
 */
export function ingredientDisplayLookupKey(raw: string): string {
  return raw
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** 원문(또는 동의 표기) → locale 표시명. 알 수 없으면 호출측 fallback. */
export const INGREDIENT_DISPLAY_BY_RAW: Readonly<
  Record<string, IngredientDisplayLabels>
> = {
  "hyaluronic acid": { ko: "히알루론산", en: "Hyaluronic Acid" },
  "sodium hyaluronate": { ko: "히알루론산나트륨", en: "Sodium Hyaluronate" },
  "low molecular hyaluronic acid": {
    ko: "저분자 히알루론산",
    en: "Low Molecular Hyaluronic Acid",
  },
  panthenol: { ko: "판테놀", en: "Panthenol" },
  "panthenol (vitamin b5)": {
    ko: "판테놀(비타민 B5)",
    en: "Panthenol (Vitamin B5)",
  },
  "centella asiatica": { ko: "센텔라 아시아티카", en: "Centella Asiatica" },
  "centella asiatica (cica)": {
    ko: "센텔라 아시아티카(시카)",
    en: "Centella Asiatica (Cica)",
  },
  "rice extract": { ko: "쌀 추출물", en: "Rice Extract" },
  ceramide: { ko: "세라마이드", en: "Ceramide" },
  ceramides: { ko: "세라마이드", en: "Ceramide" },
  niacinamide: { ko: "니아신아마이드", en: "Niacinamide" },
  allantoin: { ko: "알란토인", en: "Allantoin" },
  glycerin: { ko: "글리세린", en: "Glycerin" },
  glycerine: { ko: "글리세린", en: "Glycerin" },
  "snail secretion filtrate": {
    ko: "달팽이 뮤신",
    en: "Snail Secretion Filtrate",
  },
  "snail mucin": { ko: "달팽이 뮤신", en: "Snail Mucin" },
  propolis: { ko: "프로폴리스", en: "Propolis" },
  heartleaf: { ko: "어성초", en: "Heartleaf" },
  "green tea extract": { ko: "녹차 추출물", en: "Green Tea Extract" },
  "green tea": { ko: "녹차", en: "Green Tea" },
  peptide: { ko: "펩타이드", en: "Peptide" },
  peptides: { ko: "펩타이드", en: "Peptide" },
  squalane: { ko: "스쿠알란", en: "Squalane" },
};

/** 매칭 canonical(정규화 키) → 선호 KO 표시 (alias 그룹 첫 한글보다 자연스러운 표기) */
export const INGREDIENT_DISPLAY_BY_CANONICAL: Readonly<
  Record<string, IngredientDisplayLabels>
> = {
  panthenol: { ko: "판테놀", en: "Panthenol" },
  centellaasiatica: { ko: "센텔라 아시아티카", en: "Centella Asiatica" },
  hyaluronicacid: { ko: "히알루론산", en: "Hyaluronic Acid" },
  ceramide: { ko: "세라마이드", en: "Ceramide" },
  niacinamide: { ko: "니아신아마이드", en: "Niacinamide" },
  allantoin: { ko: "알란토인", en: "Allantoin" },
  glycerin: { ko: "글리세린", en: "Glycerin" },
  snailmucin: { ko: "달팽이 뮤신", en: "Snail Mucin" },
  propolis: { ko: "프로폴리스", en: "Propolis" },
  heartleaf: { ko: "어성초", en: "Heartleaf" },
  greentea: { ko: "녹차", en: "Green Tea" },
  peptide: { ko: "펩타이드", en: "Peptide" },
  squalane: { ko: "스쿠알란", en: "Squalane" },
};

export function pickIngredientDisplayLabel(
  labels: IngredientDisplayLabels | undefined,
  locale: IngredientDisplayLocale
): string | null {
  if (!labels) return null;
  if (locale === "ko") return labels.ko;
  if (locale === "ja") return labels.ja ?? labels.en ?? labels.ko;
  return labels.en ?? labels.ko;
}

import { getCanonicalBrandName } from "@/lib/brand/displayBrandName";
import { toCanonical } from "./normalizeIngredient";
import type {
  CurrentProductInput,
  CurrentProductReaction,
  CurrentProductUsageTime,
  Recommendation,
} from "./types";

const USAGE_TIMES: readonly CurrentProductUsageTime[] = [
  "morning",
  "evening",
  "both",
] as const;

const REACTIONS: readonly CurrentProductReaction[] = [
  "comfortable",
  "dryness",
  "stinging",
  "redness",
  "breakout",
  "unknown",
] as const;

const IRRITATION_REACTIONS: ReadonlySet<CurrentProductReaction> = new Set([
  "stinging",
  "redness",
  "breakout",
]);

/** 자극·각질 관리로 주의가 필요한 성분 키워드 (캐논컬/소문자 부분 비교용) */
const ACTIVES_HINTS = [
  "retinol",
  "retinal",
  "retinoid",
  "aha",
  "bha",
  "pha",
  "glycolic",
  "salicylic",
  "lactic",
  "benzoyl",
  "vitamin c",
  "ascorbic",
  "niacinamide",
  "레티놀",
  "레티날",
  "살리실",
  "글리콜",
  "아하",
  "바하",
  "비타민c",
  "나이아신아마이드",
];

const MOISTURE_CATEGORY_HINTS = [
  "cream",
  "moisturizer",
  "moisturiser",
  "lotion",
  "크림",
  "보습",
  "로션",
  "emulsion",
  "에멀전",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function parseUsageTime(value: unknown): CurrentProductUsageTime | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  return (USAGE_TIMES as readonly string[]).includes(v)
    ? (v as CurrentProductUsageTime)
    : undefined;
}

function parseReaction(value: unknown): CurrentProductReaction | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  return (REACTIONS as readonly string[]).includes(v)
    ? (v as CurrentProductReaction)
    : undefined;
}

function newProductId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 요청/저장용 현재 사용 제품 정규화.
 * productName 없는 항목은 제외. id 없으면 생성.
 */
export function normalizeCurrentProducts(value: unknown): CurrentProductInput[] {
  if (!Array.isArray(value)) return [];
  const out: CurrentProductInput[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const productNameRaw =
      item.productName ?? item.product_name ?? item.name;
    if (typeof productNameRaw !== "string" || !productNameRaw.trim()) continue;

    const brandRaw = item.brandName ?? item.brand_name ?? item.brand;
    const categoryRaw = item.category;
    const frequencyRaw =
      item.usageFrequency ?? item.usage_frequency ?? item.frequency;
    const idRaw = item.id;

    const product: CurrentProductInput = {
      id:
        typeof idRaw === "string" && idRaw.trim()
          ? idRaw.trim()
          : newProductId(),
      productName: productNameRaw.trim(),
    };

    if (typeof brandRaw === "string" && brandRaw.trim()) {
      product.brandName =
        getCanonicalBrandName(brandRaw) ?? brandRaw.trim();
    }
    if (typeof categoryRaw === "string" && categoryRaw.trim()) {
      product.category = categoryRaw.trim();
    }
    const usageTime = parseUsageTime(item.usageTime ?? item.usage_time);
    if (usageTime) product.usageTime = usageTime;
    if (typeof frequencyRaw === "string" && frequencyRaw.trim()) {
      product.usageFrequency = frequencyRaw.trim();
    }
    const keys = normalizeStringList(
      item.keyIngredients ?? item.key_ingredients ?? item.ingredients
    );
    if (keys.length) product.keyIngredients = keys;
    const reaction = parseReaction(item.reaction);
    if (reaction) product.reaction = reaction;

    out.push(product);
  }

  return out;
}

function labelOf(product: CurrentProductInput): string {
  const brand = product.brandName?.trim();
  return brand ? `${brand} ${product.productName}` : product.productName;
}

function ingredientHitsActive(label: string): boolean {
  const lower = label.toLowerCase();
  const canonical = toCanonical(label);
  return ACTIVES_HINTS.some(
    (hint) =>
      lower.includes(hint) ||
      (canonical.length > 0 && canonical.includes(hint.replace(/\s+/g, "")))
  );
}

function isMoistureCategory(category: string | undefined): boolean {
  if (!category) return false;
  const lower = category.toLowerCase();
  return MOISTURE_CATEGORY_HINTS.some((h) => lower.includes(h));
}

function pushUnique(list: string[], message: string): void {
  if (!message.trim()) return;
  if (list.some((x) => x === message)) return;
  list.push(message);
}

export type CurrentRoutineReview = {
  currentRoutineIssues: string[];
  duplicateFunctions: string[];
  routineSimplificationSuggestions: string[];
  currentProductWarnings: string[];
  suggestedMorningOrder: string[];
  suggestedEveningOrder: string[];
};
/**
 * 현재 사용 제품 기반 루틴 점검 (제품명만으로 전성분 추측하지 않음).
 * Mock·AI 응답 폴백·결과 보강에 사용.
 */
export function reviewCurrentRoutine(
  products: CurrentProductInput[],
  allergyIngredients: string[] = [],
  avoidedIngredients: string[] = []
): CurrentRoutineReview {
  const currentRoutineIssues: string[] = [];
  const duplicateFunctions: string[] = [];
  const routineSimplificationSuggestions: string[] = [];
  const currentProductWarnings: string[] = [];
  const suggestedMorningOrder: string[] = [];
  const suggestedEveningOrder: string[] = [];

  if (products.length === 0) {
    return {
      currentRoutineIssues: [],
      duplicateFunctions: [],
      routineSimplificationSuggestions: [],
      currentProductWarnings: [],
      suggestedMorningOrder: [],
      suggestedEveningOrder: [],
    };
  }

  const nameOnly = products.filter(
    (p) => !p.keyIngredients || p.keyIngredients.length === 0
  );
  if (nameOnly.length > 0) {
    pushUnique(
      currentProductWarnings,
      "제품명만 입력된 항목은 전성분을 추측하지 않았습니다. 핵심 성분을 추가하면 점검이 더 정확해집니다."
    );
  }

  const irritation = products.filter(
    (p) => p.reaction && IRRITATION_REACTIONS.has(p.reaction)
  );
  if (irritation.length > 0) {
    const names = irritation.map(labelOf).join(", ");
    pushUnique(
      currentRoutineIssues,
      `${names} 사용 후 따가움·붉어짐·트러블 반응이 있어 보입니다. 새 제품 추가보다 해당 제품 중단 검토와 루틴 단순화를 우선하세요.`
    );
    pushUnique(
      routineSimplificationSuggestions,
      "자극 반응이 있는 제품을 잠시 빼고, 클렌저·보습·자외선 차단 중심으로 단순화해 보세요."
    );
    for (const p of irritation) {
      pushUnique(
        currentProductWarnings,
        `${labelOf(p)}: 반응이 있으면 사용을 중단하고 상태를 관찰하세요. (의료 진단이 아닙니다)`
      );
    }
  }

  const moistureProducts = products.filter(
    (p) =>
      isMoistureCategory(p.category) ||
      /보습|크림|로션|moisturizer|cream|lotion/i.test(p.productName)
  );
  if (moistureProducts.length >= 2) {
    pushUnique(
      duplicateFunctions,
      `보습 목적 제품이 ${moistureProducts.length}개로 겹칠 수 있습니다 (${moistureProducts.map(labelOf).join(", ")}).`
    );
    pushUnique(
      routineSimplificationSuggestions,
      "보습 단계가 많다면 질감이 가벼운 하나와 필요한 크림 하나로 줄여 볼 수 있습니다."
    );
  }

  const eveningHeavy = products.filter(
    (p) => p.usageTime === "evening" || p.usageTime === "both"
  );
  if (eveningHeavy.length >= 3) {
    pushUnique(
      currentRoutineIssues,
      `저녁에 쓰는 제품이 ${eveningHeavy.length}개입니다. 단계가 많으면 자극이 쌓일 수 있어 단순화를 검토해 보세요.`
    );
  }

  // 사용자 입력 핵심 성분만으로 중복·충돌 점검
  const ingredientOwners = new Map<string, string[]>();
  for (const p of products) {
    for (const ing of p.keyIngredients ?? []) {
      const key = toCanonical(ing) || ing.toLowerCase();
      if (!key) continue;
      const list = ingredientOwners.get(key) ?? [];
      list.push(labelOf(p));
      ingredientOwners.set(key, list);
    }
  }

  for (const [canonical, owners] of ingredientOwners) {
    if (owners.length < 2) continue;
    const sample =
      products
        .flatMap((p) => p.keyIngredients ?? [])
        .find((ing) => (toCanonical(ing) || ing.toLowerCase()) === canonical) ??
      canonical;
    pushUnique(
      duplicateFunctions,
      `${sample} 성분이 ${owners.length}개 제품에 중복 입력되어 있습니다 (${[...new Set(owners)].join(", ")}).`
    );
  }

  const activeHits: string[] = [];
  for (const p of products) {
    for (const ing of p.keyIngredients ?? []) {
      if (ingredientHitsActive(ing)) {
        activeHits.push(`${labelOf(p)} (${ing})`);
      }
    }
  }
  if (activeHits.length >= 2) {
    pushUnique(
      currentProductWarnings,
      `각질·활성 성분으로 보이는 입력이 여러 제품에 있습니다: ${activeHits.join(", ")}. 동시 사용 빈도를 줄이거나 번갈아 쓰는 것을 검토하세요.`
    );
  }

  const forbidden = [...allergyIngredients, ...avoidedIngredients]
    .map((x) => x.trim())
    .filter(Boolean);
  for (const p of products) {
    for (const ing of p.keyIngredients ?? []) {
      const ingCanon = toCanonical(ing) || ing.toLowerCase();
      for (const f of forbidden) {
        const fCanon = toCanonical(f) || f.toLowerCase();
        if (!fCanon || !ingCanon) continue;
        if (ingCanon === fCanon) {
          pushUnique(
            currentProductWarnings,
            `${labelOf(p)}의 입력 성분 "${ing}"이(가) 알레르기·회피 목록의 "${f}"과(와) 겹칩니다. 사용을 재검토하세요.`
          );
        }
      }
    }
  }

  const morning = products.filter(
    (p) => p.usageTime === "morning" || p.usageTime === "both" || !p.usageTime
  );
  const evening = products.filter(
    (p) => p.usageTime === "evening" || p.usageTime === "both" || !p.usageTime
  );

  const orderHint = (list: CurrentProductInput[]): string[] => {
    const cleansers = list.filter((p) =>
      /cleanser|클렌저|세안/i.test(`${p.category ?? ""} ${p.productName}`)
    );
    const rest = list.filter((p) => !cleansers.includes(p));
    const spf = rest.filter((p) =>
      /spf|sunscreen|자외선|선크림/i.test(
        `${p.category ?? ""} ${p.productName}`
      )
    );
    const mid = rest.filter((p) => !spf.includes(p));
    return [...cleansers, ...mid, ...spf].map(labelOf);
  };

  for (const name of orderHint(morning)) {
    pushUnique(suggestedMorningOrder, name);
  }
  for (const name of orderHint(evening)) {
    pushUnique(suggestedEveningOrder, name);
  }

  if (
    products.length >= 2 &&
    routineSimplificationSuggestions.length === 0 &&
    !irritation.length
  ) {
    pushUnique(
      routineSimplificationSuggestions,
      "효과가 비슷한 단계가 있으면 하나씩 빼 보며 피부에 맞는 최소 루틴을 찾아보세요."
    );
  }

  return {
    currentRoutineIssues,
    duplicateFunctions,
    routineSimplificationSuggestions,
    currentProductWarnings,
    suggestedMorningOrder,
    suggestedEveningOrder,
  };
}

/** AI 응답 필드가 비어 있으면 로컬 점검을 채운다. currentProducts는 요청 값으로 고정. */
export function mergeCurrentRoutineIntoRecommendation(
  recommendation: Recommendation,
  products: CurrentProductInput[],
  allergyIngredients: string[] = [],
  avoidedIngredients: string[] = []
): Recommendation {
  const local = reviewCurrentRoutine(
    products,
    allergyIngredients,
    avoidedIngredients
  );

  const pick = (ai: string[] | undefined, fallback: string[]): string[] =>
    ai && ai.length > 0 ? ai : fallback;

  return {
    ...recommendation,
    currentProducts: products,
    currentRoutineIssues: pick(
      recommendation.currentRoutineIssues,
      local.currentRoutineIssues
    ),
    duplicateFunctions: pick(
      recommendation.duplicateFunctions,
      local.duplicateFunctions
    ),
    routineSimplificationSuggestions: pick(
      recommendation.routineSimplificationSuggestions,
      local.routineSimplificationSuggestions
    ),
    currentProductWarnings: pick(
      recommendation.currentProductWarnings,
      local.currentProductWarnings
    ),
    suggestedMorningOrder: pick(
      recommendation.suggestedMorningOrder,
      local.suggestedMorningOrder
    ),
    suggestedEveningOrder: pick(
      recommendation.suggestedEveningOrder,
      local.suggestedEveningOrder
    ),
  };
}

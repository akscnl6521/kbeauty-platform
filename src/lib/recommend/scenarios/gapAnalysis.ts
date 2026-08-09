import { toCanonicalConcern } from "../concernAliases";
import { KR_CORE_SCENARIOS } from "./krCoreScenarios";
import type {
  ProductReadinessState,
  RecommendationScenario,
} from "./types";

export type BackupProductRow = {
  id?: number | string;
  active?: boolean | null;
  brand?: string | null;
  category?: string | null;
  verified_at?: string | null;
  full_ingredients?: string[] | null;
  key_ingredients?: string[] | null;
  skin_concern?: string | string[] | null;
  usage_area?: string | null;
  name?: string | null;
};

export type CatalogGapEvidence = {
  imageUnknown: boolean;
  offerUnknown: boolean;
  minOffersMet: boolean;
};

export type ScenarioCatalogGap = {
  scenarioId: string;
  priorityArea: RecommendationScenario["priorityArea"];
  matchedProductIds: string[];
  recommendationReadyCount: number;
  evidenceGaps: string[];
};

const INGREDIENT_CONCERN_HINTS: Readonly<Record<string, string[]>> = {
  niacinamide: ["redness", "pigmentation", "pores"],
  panthenol: ["redness", "dryness", "barrier"],
  centella: ["redness", "sensitivity", "barrier"],
  "snail secretion filtrate": ["dryness", "barrier"],
  "hyaluronic acid": ["dryness", "barrier"],
  "sodium hyaluronate": ["dryness", "barrier"],
  "salicylic acid": ["acne", "pores"],
  retinol: ["antiaging", "acne"],
  "ascorbic acid": ["pigmentation", "antiaging"],
  peptides: ["antiaging"],
};

/**
 * 배열 안에 `null` 이 섞여 온다 — 백업 JSON 에는 없었지만 Production 에는 있다
 * (2026-08-09, `key_ingredients` 원소). 여기서 터지면 분석 전체가 멈춘다.
 */
function normalizeToken(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function inferConcernsFromProduct(row: BackupProductRow): string[] {
  const out = new Set<string>();

  const rawConcern = row.skin_concern;
  if (Array.isArray(rawConcern)) {
    for (const c of rawConcern) {
      const canon = toCanonicalConcern(c);
      if (canon) out.add(canon);
    }
  } else if (typeof rawConcern === "string") {
    const canon = toCanonicalConcern(rawConcern);
    if (canon) out.add(canon);
  }

  const ingredients = [
    ...(row.full_ingredients ?? []),
    ...(row.key_ingredients ?? []),
  ];
  for (const ing of ingredients) {
    const key = normalizeToken(ing);
    for (const [hint, concerns] of Object.entries(INGREDIENT_CONCERN_HINTS)) {
      if (key.includes(hint)) {
        for (const c of concerns) out.add(c);
      }
    }
  }

  const category = normalizeToken(row.category ?? "");
  if (category === "eye_cream") out.add("antiaging");

  // **자외선 제품은 «선크림» 만이 아니다.** 선 미스트·선스틱·선쿠션도 자외선
  // 고민에 답한다. 유형이 `sunscreen` 일 때만 `uv` 를 붙이면 `모이스트 프레쉬
  // 선 미스트` 같은 제품이 자외선 시나리오에서 통째로 빠진다(2026-08-09 실측).
  //
  // 유형이 선케어 계열이거나 **이름이 자외선 제품이라고 말하면** 붙인다.
  const SUN_CATEGORIES = [
    "sunscreen",
    "sun_cream",
    "sun_lotion",
    "sun_gel",
    "sun_stick",
    "sun_cushion",
    "sun_spray",
    "tone_up_sunscreen",
  ];
  const name = normalizeToken(row.name ?? "");
  const nameSaysSun = /선\s*미스트|선\s*크림|선\s*스틱|선\s*세럼|선\s*스킨|자외선|sunscreen|spf|pa\+/i.test(
    String(row.name ?? "")
  );
  if (SUN_CATEGORIES.includes(category) || nameSaysSun) out.add("uv");
  void name;

  return [...out];
}

function mapUsageArea(value?: string | null): string {
  const t = normalizeToken(value ?? "face");
  if (t.includes("eye")) return "eye_area";
  if (t.includes("neck")) return "neck";
  return t || "face";
}

/**
 * 이미지가 있는지 **부르는 쪽이 알려줄 수 있다.**
 *
 * 원래 이 분석기는 백업 JSON 만 봤고, 백업에는 이미지 정보가 없어서
 * `imageUnknown` 을 `true` 로 박아 두었다. 그런데 `imageUnknown` 이면 무조건
 * `review_required` 라서 — **`recommendation_ready` 가 구조적으로 영원히 0** 이었다.
 * 추천 풀이 36 → 106건이 되도록 이 계기판은 0 을 가리켰다(2026-08-09 발견).
 *
 * 이미지는 `products` 가 아니라 `catalog_product_media` 에 있다. 그래서 행만
 * 봐서는 알 수 없고, 아는 쪽이 넣어 주는 게 맞다. 안 넣으면 예전과 똑같이
 * «모른다» 로 둔다 — 없는 정보를 있다고 치지 않는다.
 */
export type ReadinessContext = {
  imageReadyProductIds?: ReadonlySet<string>;
};

export function estimateProductReadiness(
  row: BackupProductRow,
  offerCount = 0,
  ctx: ReadinessContext = {}
): { state: ProductReadinessState; evidence: CatalogGapEvidence } {
  const ingredients = row.full_ingredients ?? [];
  const hasCategory = Boolean(row.category && row.category.trim());
  const active = row.active === true;
  const verified = Boolean(row.verified_at);

  const imageKnown =
    ctx.imageReadyProductIds != null && ctx.imageReadyProductIds.has(String(row.id ?? ""));
  const evidence: CatalogGapEvidence = {
    imageUnknown: !imageKnown,
    offerUnknown: offerCount === 0,
    minOffersMet: offerCount >= 1,
  };

  const gaps: string[] = [];
  if (evidence.imageUnknown) gaps.push("image_unverified_in_backup");
  if (evidence.offerUnknown) gaps.push("offer_count_unknown_or_zero");

  if (!active) {
    return { state: "unavailable", evidence };
  }
  if (!verified) {
    return { state: "review_required", evidence };
  }
  if (!hasCategory) {
    return { state: "catalog_ready", evidence };
  }
  if (ingredients.length < 5) {
    return { state: "ingredient_candidate", evidence };
  }

  if (evidence.imageUnknown || !evidence.minOffersMet) {
    return { state: "review_required", evidence };
  }

  return { state: "recommendation_ready", evidence };
}

/**
 * **시나리오의 유형 이름과 카탈로그 표준 분류는 어휘가 다르다.**
 *
 * 시나리오(`KR_CORE_SCENARIOS`)는 `mist` · `moisturizer` · `spot_treatment` ·
 * `cleanser` 처럼 **굵은 이름**을 쓴다. 카탈로그 표준(`FACE_SKINCARE_CATEGORIES`)은
 * `facial_mist` · `cream` · `spot_care` · `foam_cleanser` 처럼 **잘게** 나눈다.
 *
 * 2026-08-09 에 제품 유형을 표준 분류로 맞추면서 이 어긋남이 드러났다 —
 * `mist` 를 `facial_mist` 로 바꾸자 시나리오가 그 제품을 못 알아봤다.
 * 데이터를 어느 한쪽으로 계속 옮기는 대신 **여기서 잇는다.** 어휘는 둘 다
 * 나름의 이유가 있고(시나리오는 사용자 언어, 카탈로그는 유통 표준),
 * 한쪽을 지우면 다른 쪽이 못 쓰게 된다.
 */
const SCENARIO_CATEGORY_EQUIVALENTS: Readonly<Record<string, readonly string[]>> = {
  mist: ["mist", "facial_mist"],
  moisturizer: ["moisturizer", "cream", "gel_cream", "lotion", "emulsion"],
  spot_treatment: ["spot_treatment", "spot_care"],
  cleanser: [
    "cleanser",
    "foam_cleanser",
    "gel_cleanser",
    "powder_cleanser",
    "cleansing_oil",
    "cleansing_balm",
    "cleansing_water",
    "cleansing_milk",
  ],
  emulsion: ["emulsion", "lotion"],
  mask: ["mask", "sheet_mask", "sleeping_mask", "wash_off_mask", "hydrogel_mask", "modeling_mask"],
  sunscreen: ["sunscreen", "sun_cream", "sun_lotion", "sun_gel", "sun_stick", "sun_spray", "tone_up_sunscreen"],
};

/** 제품 유형이 그 시나리오가 찾는 유형인가. */
export function categoryMatchesScenario(productCategory: string, scenarioCategory: string): boolean {
  if (!productCategory || !scenarioCategory) return false;
  if (productCategory === scenarioCategory) return true;
  const allowed = SCENARIO_CATEGORY_EQUIVALENTS[scenarioCategory];
  return allowed ? allowed.includes(productCategory) : false;
}

export function mapProductToScenarioIds(row: BackupProductRow): string[] {
  const concerns = inferConcernsFromProduct(row);
  const category = normalizeToken(row.category ?? "");
  const bodyArea = mapUsageArea(row.usage_area);

  const ids: string[] = [];
  for (const scenario of KR_CORE_SCENARIOS) {
    if (scenario.status !== "active") continue;
    if (!concerns.includes(scenario.primaryConcern)) continue;
    if (category && !categoryMatchesScenario(category, scenario.productCategory)) continue;
    if (scenario.bodyArea !== bodyArea && bodyArea !== "face") continue;
    ids.push(scenario.scenarioId);
  }

  return ids;
}

export function analyzeScenarioCatalogGaps(
  products: readonly BackupProductRow[],
  offerCountsByProductId: Readonly<Record<string, number>> = {},
  ctx: ReadinessContext = {}
): ScenarioCatalogGap[] {
  const byScenario = new Map<string, ScenarioCatalogGap>();

  for (const scenario of KR_CORE_SCENARIOS) {
    byScenario.set(scenario.scenarioId, {
      scenarioId: scenario.scenarioId,
      priorityArea: scenario.priorityArea,
      matchedProductIds: [],
      recommendationReadyCount: 0,
      evidenceGaps: [],
    });
  }

  for (const row of products) {
    const productId = String(row.id ?? "");
    const scenarioIds = mapProductToScenarioIds(row);
    const offerCount = offerCountsByProductId[productId] ?? 0;
    const readiness = estimateProductReadiness(row, offerCount, ctx);

    for (const scenarioId of scenarioIds) {
      const entry = byScenario.get(scenarioId);
      if (!entry) continue;
      if (productId) entry.matchedProductIds.push(productId);
      if (readiness.state === "recommendation_ready") {
        entry.recommendationReadyCount += 1;
      }
      if (readiness.evidence.imageUnknown) {
        entry.evidenceGaps.push("image_unknown_from_backup");
      }
      if (readiness.evidence.offerUnknown) {
        entry.evidenceGaps.push("offer_unknown_from_backup");
      }
    }
  }

  return [...byScenario.values()].map((entry) => ({
    ...entry,
    matchedProductIds: [...new Set(entry.matchedProductIds)],
    evidenceGaps: [...new Set(entry.evidenceGaps)],
  }));
}

export type ScenarioAreaCoverage = {
  priorityArea: RecommendationScenario["priorityArea"];
  scenarioCount: number;
  readyScenarioCount: number;
  totalMatchedProducts: number;
  readinessRatePercent: number;
};

export type ScenarioCoverageSummary = {
  scenarioCount: number;
  readyScenarioCount: number;
  readinessRatePercent: number;
  byArea: ScenarioAreaCoverage[];
};

/**
 * Aggregates raw gap rows into an honest coverage summary — no fabrication,
 * no auto-fill. A scenario counts as "ready" only when a real matched product
 * reached recommendationReadyCount > 0 (see estimateProductReadiness).
 */
export function summarizeScenarioCoverage(
  gaps: readonly ScenarioCatalogGap[]
): ScenarioCoverageSummary {
  const byAreaMap = new Map<
    RecommendationScenario["priorityArea"],
    { scenarioCount: number; readyScenarioCount: number; totalMatchedProducts: number }
  >();

  for (const gap of gaps) {
    const entry = byAreaMap.get(gap.priorityArea) ?? {
      scenarioCount: 0,
      readyScenarioCount: 0,
      totalMatchedProducts: 0,
    };
    entry.scenarioCount += 1;
    if (gap.recommendationReadyCount > 0) entry.readyScenarioCount += 1;
    entry.totalMatchedProducts += gap.matchedProductIds.length;
    byAreaMap.set(gap.priorityArea, entry);
  }

  const byArea: ScenarioAreaCoverage[] = [...byAreaMap.entries()].map(
    ([priorityArea, v]) => ({
      priorityArea,
      scenarioCount: v.scenarioCount,
      readyScenarioCount: v.readyScenarioCount,
      totalMatchedProducts: v.totalMatchedProducts,
      readinessRatePercent:
        v.scenarioCount === 0
          ? 0
          : Math.round((v.readyScenarioCount / v.scenarioCount) * 1000) / 10,
    })
  );

  const scenarioCount = gaps.length;
  const readyScenarioCount = gaps.filter(
    (g) => g.recommendationReadyCount > 0
  ).length;

  return {
    scenarioCount,
    readyScenarioCount,
    readinessRatePercent:
      scenarioCount === 0
        ? 0
        : Math.round((readyScenarioCount / scenarioCount) * 1000) / 10,
    byArea,
  };
}

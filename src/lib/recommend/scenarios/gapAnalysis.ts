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
  if (category === "sunscreen") out.add("uv");
  if (category === "eye_cream") out.add("antiaging");

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

export function mapProductToScenarioIds(row: BackupProductRow): string[] {
  const concerns = inferConcernsFromProduct(row);
  const category = normalizeToken(row.category ?? "");
  const bodyArea = mapUsageArea(row.usage_area);

  const ids: string[] = [];
  for (const scenario of KR_CORE_SCENARIOS) {
    if (scenario.status !== "active") continue;
    if (!concerns.includes(scenario.primaryConcern)) continue;
    if (category && scenario.productCategory !== category) continue;
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

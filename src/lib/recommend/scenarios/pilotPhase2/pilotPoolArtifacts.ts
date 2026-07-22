import scenarioPoolsJson from "../../../../../data/catalog/scenario-pilot-enrichment-de/2026-07-22/scenario-pools.json";
import productsRegistryJson from "../../../../../data/catalog/scenario-pilot-enrichment-de/2026-07-22/products.json";
import readinessReportJson from "../../../../../data/catalog/scenario-pilot-enrichment-de/2026-07-22/readiness-report.json";
import type { ProductReadinessState } from "../types";
import type { PilotPoolSlot, PilotScenarioPool } from "./types";
import {
  PILOT_CANDIDATE_POOL_VERSION,
  PILOT_INSUFFICIENT_SCENARIO_IDS,
  PILOT_POOL_ARTIFACT_DATE,
  PILOT_PRODUCT_EVIDENCE_VERSION,
  PILOT_RUNTIME_ABC_SCENARIO_IDS,
} from "./constants";

type ScenarioPoolsFile = Record<string, PilotScenarioPool>;

type ProductRegistryEntry = {
  externalProductId: string;
  readiness: ProductReadinessState;
  affiliateOrAdInScore?: boolean;
  productIdentity?: {
    productId: string;
    scenarioIds?: string[];
    category?: string;
  };
  qualityNotes?: string[];
};

const scenarioPools = scenarioPoolsJson as ScenarioPoolsFile;

const productsRegistry = productsRegistryJson as {
  products: ProductRegistryEntry[];
};

const readinessReport = readinessReportJson as {
  perScenario: Record<
    string,
    { recommendation_ready: number }
  >;
};

export function getPilotScenarioPool(
  scenarioId: string
): PilotScenarioPool | null {
  return scenarioPools[scenarioId] ?? null;
}

export function listPilotPoolScenarioIds(): string[] {
  return Object.keys(scenarioPools);
}

/** Slots with recommendation_ready only — never lower readiness states. */
export function getRecommendationReadySlots(
  scenarioId: string
): PilotPoolSlot[] {
  const pool = getPilotScenarioPool(scenarioId);
  if (!pool) return [];
  return pool.slots.filter((slot) => slot.readiness === "recommendation_ready");
}

export function countRecommendationReadyInPool(scenarioId: string): number {
  return getRecommendationReadySlots(scenarioId).length;
}

export function getPilotReadyCountFromReport(scenarioId: string): number {
  return readinessReport.perScenario[scenarioId]?.recommendation_ready ?? 0;
}

export function getReadySlugsForScenario(scenarioId: string): string[] {
  return getRecommendationReadySlots(scenarioId).map((slot) => slot.productId);
}

export function isPilotRuntimeAbcScenario(scenarioId: string): boolean {
  return (PILOT_RUNTIME_ABC_SCENARIO_IDS as readonly string[]).includes(
    scenarioId
  );
}

export function isPilotInsufficientScenario(scenarioId: string): boolean {
  return (PILOT_INSUFFICIENT_SCENARIO_IDS as readonly string[]).includes(
    scenarioId
  );
}

export function getProductRegistryEntry(
  externalProductId: string
): ProductRegistryEntry | undefined {
  return productsRegistry.products.find(
    (p) => p.externalProductId === externalProductId
  );
}

/** KR runtime: reject explicit US split SKUs (e.g. round-lab-*-us). */
export function isRegionalSkuExcludedForKr(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.endsWith("-us")) return true;
  const entry = getProductRegistryEntry(normalized);
  const notes = entry?.qualityNotes ?? [];
  return notes.some((note) =>
    /us\s+sku|us uvlock|kr\/us/i.test(note)
  );
}

export function getPoolArtifactVersions(): {
  candidatePoolVersion: string;
  productEvidenceVersion: string;
  artifactDate: string;
} {
  return {
    candidatePoolVersion: PILOT_CANDIDATE_POOL_VERSION,
    productEvidenceVersion: PILOT_PRODUCT_EVIDENCE_VERSION,
    artifactDate: PILOT_POOL_ARTIFACT_DATE,
  };
}

export function assertPoolAffiliateForbidden(scenarioId: string): boolean {
  const pool = getPilotScenarioPool(scenarioId);
  return pool?.affiliateOrAdInScore === false;
}

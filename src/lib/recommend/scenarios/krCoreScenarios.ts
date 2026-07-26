import raw from "./krCoreScenarios.json";
import type { RecommendationScenario } from "./types";

/** Curated KR recommendation scenarios (generated). Not a Cartesian product. */
export const KR_CORE_SCENARIOS: readonly RecommendationScenario[] =
  raw as RecommendationScenario[];

export function getScenarioById(
  scenarioId: string
): RecommendationScenario | undefined {
  return KR_CORE_SCENARIOS.find((s) => s.scenarioId === scenarioId);
}

export function listActiveKrScenarios(): RecommendationScenario[] {
  return KR_CORE_SCENARIOS.filter((s) => s.status === "active");
}

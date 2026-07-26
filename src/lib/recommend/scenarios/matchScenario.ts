import { toCanonicalConcern } from "../concernAliases";
import { KR_CORE_SCENARIOS } from "./krCoreScenarios";
import type { RecommendationScenario, ScenarioMatchInput } from "./types";

const BLOCKED_MANAGEMENT_LEVELS = new Set(["expert_first", "urgent_check"]);

export function isPoolEntryBlockedByManagementLevel(
  managementLevel?: string | null
): boolean {
  if (!managementLevel) return false;
  return BLOCKED_MANAGEMENT_LEVELS.has(managementLevel.trim());
}

function normalizeCategory(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim().toLowerCase();
  return t || null;
}

function normalizeBodyArea(value?: string | null): string {
  const t = (value ?? "face").trim().toLowerCase();
  return t || "face";
}

function normalizeSensitivity(
  value?: ScenarioMatchInput["sensitivityLevel"]
): string {
  const t = (value ?? "moderate").toString().trim().toLowerCase();
  if (t === "low" || t === "moderate" || t === "high") return t;
  return "moderate";
}

/**
 * Match a curated scenario by primaryConcern + productCategory + sensitivity + bodyArea.
 * Does NOT enumerate a Cartesian product of all axes.
 */
export function matchScenario(
  input: ScenarioMatchInput,
  scenarios: readonly RecommendationScenario[] = KR_CORE_SCENARIOS
): RecommendationScenario | null {
  if (isPoolEntryBlockedByManagementLevel(input.managementLevel)) {
    return null;
  }

  const concern = toCanonicalConcern(input.primaryConcern);
  if (!concern) return null;

  const category = normalizeCategory(input.productCategory);
  const bodyArea = normalizeBodyArea(input.bodyArea);
  const sensitivity = normalizeSensitivity(input.sensitivityLevel);

  for (const scenario of scenarios) {
    if (scenario.status !== "active") continue;
    if (scenario.primaryConcern !== concern) continue;
    if (category && scenario.productCategory !== category) continue;
    if (scenario.bodyArea !== bodyArea) continue;
    if (scenario.sensitivityLevel !== sensitivity) continue;
    return scenario;
  }

  return null;
}

export function matchScenarioOrFallback(
  input: ScenarioMatchInput,
  scenarios: readonly RecommendationScenario[] = KR_CORE_SCENARIOS
): RecommendationScenario | null {
  const exact = matchScenario(input, scenarios);
  if (exact) return exact;

  if (isPoolEntryBlockedByManagementLevel(input.managementLevel)) {
    return null;
  }

  const concern = toCanonicalConcern(input.primaryConcern);
  if (!concern) return null;
  const category = normalizeCategory(input.productCategory);
  const bodyArea = normalizeBodyArea(input.bodyArea);

  return (
    scenarios.find(
      (s) =>
        s.status === "active" &&
        s.primaryConcern === concern &&
        (!category || s.productCategory === category) &&
        s.bodyArea === bodyArea
    ) ?? null
  );
}

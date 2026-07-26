import {
  isPoolEntryBlockedByManagementLevel,
  matchScenario,
  matchScenarioOrFallback,
} from "../matchScenario";
import type { RecommendationScenario, ScenarioMatchInput } from "../types";
import { listPilotPhase2Scenarios } from "./pilotScenarioRegistry";
import type { PilotScenarioMatch, ScenarioPilotMatchConfidence } from "./types";

function scoreMatchConfidence(
  input: ScenarioMatchInput,
  scenario: RecommendationScenario,
  usedFallback: boolean
): ScenarioPilotMatchConfidence {
  if (usedFallback) return "low";
  const category = input.productCategory?.trim().toLowerCase();
  if (category && scenario.productCategory === category) return "high";
  return "medium";
}

function buildMatchReason(
  input: ScenarioMatchInput,
  scenario: RecommendationScenario,
  usedFallback: boolean
): string {
  const parts = [
    `primaryConcern=${scenario.primaryConcern}`,
    `category=${scenario.productCategory}`,
    `bodyArea=${scenario.bodyArea}`,
    `sensitivity=${scenario.sensitivityLevel}`,
  ];
  if (usedFallback) {
    parts.push("fallback=relaxed_sensitivity");
  }
  if (input.productCategory && input.productCategory !== scenario.productCategory) {
    parts.push(`inferredCategory=${input.productCategory}`);
  }
  return parts.join("; ");
}

/**
 * Match one of five pilot scenarios (A–E) from analysis axes.
 * Does not enumerate a Cartesian product.
 */
export function matchPilotScenario(
  input: ScenarioMatchInput
): PilotScenarioMatch | null {
  if (isPoolEntryBlockedByManagementLevel(input.managementLevel)) {
    return null;
  }

  const scenarios = listPilotPhase2Scenarios();
  const exact = matchScenario(input, scenarios);
  if (exact) {
    return {
      scenario: exact,
      confidence: scoreMatchConfidence(input, exact, false),
      reason: buildMatchReason(input, exact, false),
    };
  }

  const fallback = matchScenarioOrFallback(input, scenarios);
  if (!fallback) return null;

  return {
    scenario: fallback,
    confidence: scoreMatchConfidence(input, fallback, true),
    reason: buildMatchReason(input, fallback, true),
  };
}

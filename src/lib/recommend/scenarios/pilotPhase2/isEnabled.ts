/**
 * Phase 2 pilot runtime gate.
 * Default on unless explicitly disabled (safe rollback).
 */
export function isScenarioPilotPhase2Enabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return true;
}

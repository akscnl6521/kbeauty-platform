import type { ConcernObservation } from "@/lib/ai/types";

export type ConcernObservationMap = Record<string, ConcernObservation>;

export function normalizeConcernObservationMap(
  concerns: string[],
  current: ConcernObservationMap
): ConcernObservationMap {
  const next: ConcernObservationMap = {};
  for (const concern of concerns) {
    next[concern] = current[concern] ?? {};
  }
  return next;
}

export function updateConcernObservation(
  current: ConcernObservationMap,
  concern: string,
  observation: ConcernObservation
): ConcernObservationMap {
  return {
    ...current,
    [concern]: observation,
  };
}

export function getSelectedConcernObservations(
  concerns: string[],
  current: ConcernObservationMap
): Record<string, ConcernObservation> | undefined {
  const selected = normalizeConcernObservationMap(concerns, current);
  const hasMeaningfulValue = Object.values(selected).some((observation) =>
    Boolean(
      observation.areas?.length ||
        observation.severity ||
        observation.duration ||
        observation.worsening ||
        observation.redFlags?.length
    )
  );

  return hasMeaningfulValue ? selected : undefined;
}

export function hasUrgentConcernObservation(
  observations: Record<string, ConcernObservation> | undefined
): boolean {
  if (!observations) return false;
  return Object.values(observations).some((observation) =>
    Boolean(observation.redFlags?.length)
  );
}

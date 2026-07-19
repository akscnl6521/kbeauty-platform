import type { ConcernObservation } from "@/lib/ai/types";

export type ConcernObservationDraft = Omit<ConcernObservation, "concern">;
export type ConcernObservationMap = Record<string, ConcernObservationDraft>;

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
  observation: ConcernObservationDraft
): ConcernObservationMap {
  return {
    ...current,
    [concern]: observation,
  };
}

export function getSelectedConcernObservations(
  concerns: string[],
  current: ConcernObservationMap
): ConcernObservation[] | undefined {
  const selected = normalizeConcernObservationMap(concerns, current);
  const observations = Object.entries(selected)
    .filter(([, observation]) =>
      Boolean(
        observation.areas?.length ||
          observation.severity ||
          observation.duration ||
          observation.worsening ||
          observation.redFlags?.length
      )
    )
    .map(([concern, observation]) => ({
      concern,
      ...observation,
    }));

  return observations.length > 0 ? observations : undefined;
}

export function hasUrgentConcernObservation(
  observations: ConcernObservation[] | undefined
): boolean {
  if (!observations) return false;
  return observations.some((observation) => Boolean(observation.redFlags?.length));
}

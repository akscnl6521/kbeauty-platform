import type { ConcernObservation } from "@/lib/ai/types";
import {
  getSelectedConcernObservations,
  type ConcernObservationMap,
} from "@/lib/ai/concernObservationFormState";

export type AnalyzeConcernObservationPayload = {
  concernObservations?: Record<string, ConcernObservation>;
};

export function buildAnalyzeConcernObservationPayload(input: {
  selectedConcerns: string[];
  observations: ConcernObservationMap;
}): AnalyzeConcernObservationPayload {
  const concernObservations = getSelectedConcernObservations(
    input.selectedConcerns,
    input.observations
  );

  return concernObservations ? { concernObservations } : {};
}

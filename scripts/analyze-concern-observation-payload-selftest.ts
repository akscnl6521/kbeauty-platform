import assert from "node:assert/strict";
import { buildAnalyzeConcernObservationPayload } from "../src/lib/ai/analyzeConcernObservationPayload";

const payload = buildAnalyzeConcernObservationPayload({
  selectedConcerns: ["Dryness", "Acne"],
  observations: {
    Dryness: { severity: "moderate", duration: "over_3_months" },
    Acne: { areas: ["chin"], worsening: true },
    Redness: { severity: "severe" },
  },
});

assert.deepEqual(payload.concernObservations, [
  {
    concern: "Dryness",
    severity: "moderate",
    duration: "over_3_months",
  },
  {
    concern: "Acne",
    areas: ["chin"],
    worsening: true,
  },
]);

const empty = buildAnalyzeConcernObservationPayload({
  selectedConcerns: ["UV"],
  observations: { UV: {} },
});
assert.deepEqual(empty, {});

console.log("analyze concern observation payload self-test passed");

import {
  getSelectedConcernObservations,
  hasUrgentConcernObservation,
  normalizeConcernObservationMap,
  updateConcernObservation,
} from "../src/lib/ai/concernObservationFormState";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const normalized = normalizeConcernObservationMap(
  ["건조함", "여드름"],
  { 건조함: { severity: "moderate" }, 붉은기: { severity: "mild" } }
);
assert(Object.keys(normalized).length === 2, "selected concerns only");
assert(normalized["건조함"].severity === "moderate", "keep selected value");
assert(normalized["여드름"] !== undefined, "initialize missing concern");
assert(normalized["붉은기"] === undefined, "remove deselected concern");

const updated = updateConcernObservation(normalized, "여드름", {
  duration: "under_2_weeks",
  redFlags: ["pain"],
});
assert(updated["건조함"].severity === "moderate", "preserve sibling concern");
assert(updated["여드름"].duration === "under_2_weeks", "update target concern");

const empty = getSelectedConcernObservations(["건조함"], { 건조함: {} });
assert(empty === undefined, "omit empty observation payload");

const payload = getSelectedConcernObservations(["건조함", "여드름"], updated);
const acneObservation = payload?.find((item) => item.concern === "여드름");
assert(acneObservation?.redFlags?.includes("pain"), "build selected payload");
assert(hasUrgentConcernObservation(payload), "detect red flag across concerns");
assert(!hasUrgentConcernObservation(undefined), "undefined payload is safe");

console.log("[concern-observation-form-state-selftest] ok");
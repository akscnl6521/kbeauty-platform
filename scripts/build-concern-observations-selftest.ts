import assert from "node:assert/strict";
import { buildConcernObservations } from "../src/lib/ai/buildConcernObservations";

const mild = buildConcernObservations({
  concerns: ["건조함"],
});
assert.deepEqual(mild, [{ concern: "건조함" }]);

const redness = buildConcernObservations({
  concerns: ["붉은기", "건조함"],
  rednessObservation: {
    symptoms: ["burning", "visible_capillaries"],
    duration: "persistent",
    areas: ["cheeks", "nose"],
  },
});
assert.equal(redness.length, 2);
assert.deepEqual(redness[0], {
  concern: "붉은기",
  areas: ["cheek", "nose"],
  severity: "severe",
  duration: "over_3_months",
  worsening: false,
});

const eyeRisk = buildConcernObservations({
  concerns: ["붉은기"],
  rednessObservation: {
    symptoms: ["stinging"],
    duration: "over_one_day",
    areas: ["eye_area"],
  },
});
assert.deepEqual(eyeRisk[0].redFlags, ["eye_irritation"]);

const manualOverride = buildConcernObservations({
  concerns: ["여드름"],
  drafts: {
    여드름: {
      concern: "여드름",
      areas: ["cheek", "chin"],
      severity: "severe",
      duration: "over_3_months",
      worsening: true,
      redFlags: ["pain", "oozing"],
    },
  },
});
assert.deepEqual(manualOverride[0], {
  concern: "여드름",
  areas: ["cheek", "chin"],
  severity: "severe",
  duration: "over_3_months",
  worsening: true,
  redFlags: ["pain", "oozing"],
});

console.log("buildConcernObservations selftest passed");

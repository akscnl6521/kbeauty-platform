import assert from "node:assert/strict";
import { buildClinicReviewQueue } from "../src/lib/clinic/clinicReviewQueue";

const queue = buildClinicReviewQueue([
  {
    action: "manual_review",
    clinicId: "clinic-4",
    sourceHash: "hash-4",
    reasonCodes: ["official_source_missing"],
    publishAllowed: false,
  },
  {
    action: "manual_review",
    clinicId: "clinic-3",
    sourceHash: "hash-3",
    reasonCodes: ["symptom_tags_missing"],
    publishAllowed: false,
  },
  {
    action: "manual_review",
    clinicId: "clinic-2",
    sourceHash: "hash-2",
    reasonCodes: ["partnership_disclosure_missing"],
    publishAllowed: false,
  },
  {
    action: "block_listing",
    clinicId: "clinic-1",
    sourceHash: "hash-1",
    reasonCodes: ["clinic_inactive"],
    publishAllowed: false,
  },
  {
    action: "manual_review",
    clinicId: "clinic-5",
    sourceHash: "hash-5",
    reasonCodes: ["operating_status_unconfirmed"],
    publishAllowed: false,
  },
  {
    action: "no_change",
    clinicId: "clinic-6",
    sourceHash: "hash-6",
    reasonCodes: [],
    publishAllowed: false,
  },
]);

assert.equal(queue.length, 5);
assert.deepEqual(
  queue.map((item) => item.queuePosition),
  [1, 2, 3, 4, 5]
);
assert.deepEqual(
  queue.map((item) => item.recommendedReviewAction),
  [
    "confirm_inactive_or_block",
    "verify_partnership_disclosure",
    "verify_operating_status",
    "complete_symptom_and_specialty_tags",
    "review_source_evidence",
  ]
);
assert.equal(queue[0].priority, "critical");
assert.equal(queue[1].priority, "high");
assert.equal(queue[3].priority, "medium");
assert.equal(queue[4].priority, "low");
assert(queue.every((item) => item.publishAllowed === false));
assert(!queue.some((item) => item.action === "no_change"));

console.log("clinic review queue self-test passed");

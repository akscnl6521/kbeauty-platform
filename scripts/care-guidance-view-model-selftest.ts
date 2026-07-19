import assert from "node:assert/strict";
import { buildCareGuidanceViewModel } from "../src/lib/care/guidanceViewModel";

const normal = buildCareGuidanceViewModel({
  managementLevel: "cosmetic_care",
  skinConcerns: ["건조", "민감"],
});
assert.equal(normal.showProductUsage, true);
assert.equal(normal.showPurchaseLinks, true);
assert.equal(normal.clinicMode, "none");
assert.deepEqual(normal.concerns, ["건조", "민감"]);

const combined = buildCareGuidanceViewModel({
  managementLevel: "combined_care",
  skinConcerns: ["홍조"],
});
assert.equal(combined.showProductUsage, true);
assert.equal(combined.showPurchaseLinks, true);
assert.equal(combined.clinicMode, "supportive");

const expert = buildCareGuidanceViewModel({
  managementLevel: "expert_first",
  skinConcerns: ["여드름"],
});
assert.equal(expert.showProductUsage, true);
assert.equal(expert.showPurchaseLinks, false);
assert.equal(expert.clinicMode, "priority");
assert.match(expert.commercialDisclosure, /Organic/);

const urgent = buildCareGuidanceViewModel({
  managementLevel: "urgent_check",
  skinConcerns: ["급격한 붓기"],
});
assert.equal(urgent.showProductUsage, false);
assert.equal(urgent.showPurchaseLinks, false);
assert.equal(urgent.clinicMode, "urgent");
assert.match(urgent.commercialDisclosure, /노출을 제공하지 않습니다/);

const fallback = buildCareGuidanceViewModel({ managementLevel: "unknown" });
assert.equal(fallback.managementLevel, "observe");

console.log("care guidance view model self-test passed");

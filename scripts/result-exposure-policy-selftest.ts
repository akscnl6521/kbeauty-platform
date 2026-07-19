import assert from "node:assert/strict";
import { getResultExposurePolicy } from "../src/lib/recommend/resultExposurePolicy";

{
  const policy = getResultExposurePolicy("urgent_check");
  assert.equal(policy.productExposure, "hidden");
  assert.equal(policy.showPurchaseCta, false);
  assert.equal(policy.showPriceAndRetailer, false);
  assert.equal(policy.allowCatalogBrowse, false);
}

{
  const policy = getResultExposurePolicy("expert_first");
  assert.equal(policy.productExposure, "supportive_reference_only");
  assert.equal(policy.showPurchaseCta, false);
  assert.equal(policy.showPriceAndRetailer, false);
  assert.equal(policy.allowCatalogBrowse, false);
}

for (const level of ["cosmetic_care", "observe", "combined_care", undefined] as const) {
  const policy = getResultExposurePolicy(level);
  assert.equal(policy.productExposure, "normal");
  assert.equal(policy.showPurchaseCta, true);
  assert.equal(policy.showPriceAndRetailer, true);
  assert.equal(policy.allowCatalogBrowse, true);
}

console.log("result exposure policy selftest: ok");

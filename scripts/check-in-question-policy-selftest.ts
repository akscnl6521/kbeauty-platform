import assert from "node:assert/strict";
import { getCheckInQuestionPolicy } from "../src/lib/care/checkInQuestionPolicy";

const day3 = getCheckInQuestionPolicy(3);
assert.match(day3.title, /초기 자극/);
assert.equal(day3.metrics[0]?.key, "sting");
assert.ok(day3.metrics.some((metric) => metric.key === "swelling"));

const day7 = getCheckInQuestionPolicy(7);
assert.match(day7.title, /일주일/);
assert.ok(day7.metrics.some((metric) => metric.key === "satisfaction"));
assert.ok(day7.metrics.some((metric) => metric.key === "adherence"));

const day15 = getCheckInQuestionPolicy(15);
assert.match(day15.title, /변화 추세/);
assert.equal(day15.metrics[0]?.key, "dryness");
assert.match(day15.memoPrompt, /좋아진 점/);

const day30 = getCheckInQuestionPolicy(30);
assert.match(day30.title, /한 달 결과/);
assert.equal(day30.metrics[0]?.key, "satisfaction");
assert.match(day30.memoPrompt, /전문가/);

for (const day of [3, 7, 15, 30] as const) {
  const policy = getCheckInQuestionPolicy(day);
  const keys = policy.metrics.map((metric) => metric.key);
  assert.equal(new Set(keys).size, keys.length, `Day ${day} has duplicate metrics`);
  assert.ok(policy.purpose.length > 20);
  assert.ok(policy.stillUsingLabel.length > 0);
}

console.log("check-in-question-policy-selftest: ok");

import assert from "node:assert/strict";
import {
  productFeedbackSafetyMessage,
  summarizeProductFeedback,
} from "../src/lib/care/feedbackSummary";
import type { CareFeedback } from "../src/lib/care/types";

const rows: CareFeedback[] = [
  {
    id: "1",
    createdAt: "2026-07-19T00:00:00.000Z",
    productId: "p1",
    used: true,
    purchased: true,
    satisfaction: 8,
    irritation: false,
    stopReason: null,
    repurchaseIntent: true,
    concernChange: "건조함 감소",
  },
  {
    id: "2",
    createdAt: "2026-07-19T00:00:00.000Z",
    productId: "p2",
    used: true,
    purchased: true,
    satisfaction: 4,
    irritation: true,
    stopReason: "따가움",
    repurchaseIntent: false,
    concernChange: "붉은기 증가",
  },
];

const summary = summarizeProductFeedback(rows);
assert.deepEqual(summary, {
  total: 2,
  used: 2,
  purchased: 2,
  irritation: 1,
  repurchaseYes: 1,
  averageSatisfaction: 6,
});
assert.match(productFeedbackSafetyMessage(summary) ?? "", /1개 제품/);
assert.equal(productFeedbackSafetyMessage(summarizeProductFeedback([])), null);
console.log("feedback summary self-test passed");

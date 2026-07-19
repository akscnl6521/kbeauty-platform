import assert from "node:assert/strict";
import {
  buildProductFeedback,
  feedbackCompletionLabel,
  upsertProductFeedback,
} from "../src/lib/care/productFeedback";

const base = buildProductFeedback(
  {
    productId: " product-1 ",
    used: true,
    purchased: true,
    satisfaction: 12,
    irritation: true,
    stopReason: "  따가움이 있어 중단함  ",
    repurchaseIntent: false,
    concernChange: " 붉은기가 더 심해짐 ",
  },
  { id: "fb-1", createdAt: "2026-07-19T00:00:00.000Z" }
);

assert.equal(base.productId, "product-1");
assert.equal(base.satisfaction, 10);
assert.equal(base.stopReason, "따가움이 있어 중단함");
assert.equal(feedbackCompletionLabel(base), "자극 경험 기록됨");

const notUsed = buildProductFeedback(
  {
    productId: "product-2",
    used: false,
    purchased: false,
    satisfaction: 9,
    irritation: true,
    stopReason: "구매하지 않음",
    repurchaseIntent: true,
    concernChange: "변화 없음",
  },
  { id: "fb-2" }
);

assert.equal(notUsed.satisfaction, null);
assert.equal(notUsed.irritation, null);
assert.equal(notUsed.repurchaseIntent, null);
assert.equal(notUsed.concernChange, null);
assert.equal(feedbackCompletionLabel(notUsed), "아직 사용하지 않음");

const replaced = upsertProductFeedback([base], { ...base, id: "fb-3", satisfaction: 7 });
assert.equal(replaced.length, 1);
assert.equal(replaced[0]?.id, "fb-3");
assert.equal(replaced[0]?.satisfaction, 7);

console.log("product feedback self-test passed");

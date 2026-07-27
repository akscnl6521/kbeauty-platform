/**
 * Offline assertions for the two decisions the usage-guide review screen makes:
 * whether a guide may be approved, and whether its extracted values can still be
 * found in the source excerpt.
 *
 * These were previously only exercised by the Staging e2e, which needs network
 * and a database — so a broken approval gate would not have been caught by
 * anything runnable offline. The functions themselves touch neither, they just
 * live in a server-only module, which the loader stubs.
 *
 *   npm run test:usage-guide-review-policy
 */
import assert from "node:assert/strict";
import {
  blockingReasonsForApproval,
  fieldsNotFoundInSource,
} from "@/lib/admin/usageGuideReview";
import type { UsageGuideRecord } from "@/lib/admin/usageGuideReview";

function guide(overrides: Partial<UsageGuideRecord> = {}): UsageGuideRecord {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    productId: 1,
    productName: "테스트 세럼",
    brand: "테스트",
    locale: "ko",
    amountLabel: "2~3회 펌핑",
    orderIndex: 1,
    orderHints: ["세안 후"],
    frequency: "evening",
    timeOfDay: null,
    applicationArea: ["얼굴 전체"],
    methodSteps: ["세안 후 2~3회 펌핑하여 얼굴 전체에 펴 바릅니다."],
    cautionText: [],
    statutoryNotices: ["어린이의 손이 닿지 않는 곳에 보관할 것"],
    combinationCautions: [],
    patchTestRecommended: false,
    patchTestWaitHours: null,
    patchTestSteps: [],
    sourceType: "official_brand",
    sourceUrl: "https://brand.example.com/product/1",
    sourceDomain: "brand.example.com",
    sourceExcerpt: "사용방법 세안 후 2~3회 펌핑하여 얼굴 전체에 펴 바릅니다.",
    extractionMethod: "automated_extraction",
    containsMedicalClaim: false,
    verificationStatus: "needs_review",
    verifiedAt: null,
    reviewNote: null,
    missingFields: [],
    lastCheckedAt: null,
    nextCheckDueAt: null,
    ...overrides,
  };
}

// --- the approval gate -------------------------------------------------------
assert.deepEqual(
  blockingReasonsForApproval(guide()),
  [],
  "a clean automated extraction has nothing blocking it"
);

assert.deepEqual(
  blockingReasonsForApproval(guide({ methodSteps: [] })),
  ["method_steps_missing"],
  "a guide with no usage step carries no instruction"
);

assert.ok(
  blockingReasonsForApproval(guide({ containsMedicalClaim: true })).includes(
    "medical_claim_present"
  ),
  "a medical claim blocks approval outright"
);

assert.ok(
  blockingReasonsForApproval(
    guide({ sourceUrl: null, reviewNote: null })
  ).includes("source_missing"),
  "approval needs a source or an explicit reviewer note"
);
assert.ok(
  !blockingReasonsForApproval(
    guide({ sourceUrl: null, reviewNote: "인쇄물에서 직접 확인" })
  ).includes("source_missing"),
  "a reviewer note stands in for a URL when a human entered it"
);

assert.ok(
  blockingReasonsForApproval(
    guide({ extractionMethod: "automated_extraction", sourceExcerpt: null })
  ).includes("source_excerpt_missing"),
  "an automated extraction with nothing to compare against cannot be approved"
);
assert.ok(
  !blockingReasonsForApproval(
    guide({ extractionMethod: "manual_entry", sourceExcerpt: null })
  ).includes("source_excerpt_missing"),
  "a hand-entered guide is not required to carry a page excerpt"
);

assert.ok(
  blockingReasonsForApproval(
    guide({ patchTestRecommended: true, patchTestSteps: [] })
  ).includes("patch_test_steps_missing"),
  "recommending a patch test without saying how is not approvable"
);
assert.deepEqual(
  blockingReasonsForApproval(
    guide({
      patchTestRecommended: true,
      patchTestSteps: ["팔 안쪽에 소량 도포 후 24시간 관찰"],
      patchTestWaitHours: 24,
    })
  ),
  [],
  "a patch test with steps is fine"
);

// several problems are all reported, not just the first
const manyProblems = blockingReasonsForApproval(
  guide({ methodSteps: [], containsMedicalClaim: true, sourceUrl: null })
);
assert.ok(manyProblems.length >= 3, "every blocking reason is listed");
assert.ok(manyProblems.includes("method_steps_missing"));
assert.ok(manyProblems.includes("medical_claim_present"));
assert.ok(manyProblems.includes("source_missing"));

// --- comparison against the stored excerpt ----------------------------------
assert.deepEqual(
  fieldsNotFoundInSource(guide()),
  [],
  "values that appear in the excerpt raise nothing"
);

assert.deepEqual(
  fieldsNotFoundInSource(guide({ sourceExcerpt: null })),
  [],
  "with no excerpt there is nothing to compare — the approval gate covers that case"
);

const wrongAmount = fieldsNotFoundInSource(
  guide({ amountLabel: "콩알 크기" })
);
assert.equal(wrongAmount.length, 1, "an amount absent from the excerpt is flagged");
assert.ok(
  wrongAmount[0].includes("콩알 크기"),
  "the flag names the value that could not be found"
);

const inventedStep = fieldsNotFoundInSource(
  guide({
    methodSteps: [
      "세안 후 2~3회 펌핑하여 얼굴 전체에 펴 바릅니다.",
      "이후 수분 크림으로 마무리합니다.",
    ],
  })
);
assert.equal(inventedStep.length, 1, "a step absent from the excerpt is flagged");
assert.ok(inventedStep[0].startsWith("단계:"), "flagged as a step");

// whitespace in the excerpt must not cause false alarms
assert.deepEqual(
  fieldsNotFoundInSource(
    guide({
      sourceExcerpt:
        "사용방법   세안 후   2~3회 펌핑하여\n얼굴 전체에 펴 바릅니다.",
      methodSteps: ["세안 후 2~3회 펌핑하여"],
      amountLabel: "2~3회 펌핑",
    })
  ),
  [],
  "collapsed whitespace still matches"
);

console.log("[usage-guide-review-policy] self-test: ok");

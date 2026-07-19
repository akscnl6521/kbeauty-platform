import assert from "node:assert/strict";
import { autoSaveCompletedAnalysisToCare } from "../src/lib/care/auto-save";
import { CARE_STORAGE_KEY } from "../src/lib/care/local-store";
import type { Recommendation } from "../src/lib/recommend/types";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  value: { localStorage: storage },
  configurable: true,
});

storage.setItem(
  "skinAnalysisResult",
  JSON.stringify({ skin_type: "민감성", concerns: ["붉은기"] })
);

const recommendation: Recommendation = {
  skinConcerns: ["Redness"],
  recommendedIngredients: ["Panthenol"],
  ingredientsToAvoid: ["Fragrance"],
  confidenceScore: 0.82,
  managementLevel: "cosmetic_care",
};

const first = autoSaveCompletedAnalysisToCare({
  recommendation,
  rankedProductIds: ["p2", "p1"],
  country: "KR",
});
assert.equal(first.saved, true);
assert.equal(first.sessionCount, 1);

const stored = JSON.parse(storage.getItem(CARE_STORAGE_KEY) ?? "null");
assert.equal(stored.sessions.length, 1);
assert.deepEqual(
  stored.checkIns.map((item: { day: number }) => item.day).sort((a: number, b: number) => a - b),
  [3, 7, 15, 30]
);

const duplicate = autoSaveCompletedAnalysisToCare({
  recommendation,
  rankedProductIds: ["p1", "p2"],
  country: "KR",
});
assert.equal(duplicate.saved, false);
assert.equal(duplicate.sessionCount, 1);

const oldStore = JSON.parse(storage.getItem(CARE_STORAGE_KEY) ?? "null");
oldStore.sessions[0].createdAt = "2026-07-18T00:00:00.000Z";
storage.setItem(CARE_STORAGE_KEY, JSON.stringify(oldStore));

const repeatAnalysis = autoSaveCompletedAnalysisToCare({
  recommendation,
  rankedProductIds: ["p1", "p2"],
  country: "KR",
  now: new Date("2026-07-19T00:00:01.000Z"),
});
assert.equal(repeatAnalysis.saved, true);
assert.equal(repeatAnalysis.sessionCount, 2);

const repeatedStore = JSON.parse(storage.getItem(CARE_STORAGE_KEY) ?? "null");
assert.equal(repeatedStore.checkIns.length, 8);
assert.deepEqual(
  repeatedStore.checkIns
    .slice(-4)
    .map((item: { day: number }) => item.day)
    .sort((a: number, b: number) => a - b),
  [3, 7, 15, 30]
);

const urgent = autoSaveCompletedAnalysisToCare({
  recommendation: {
    ...recommendation,
    recommendedIngredients: [],
    managementLevel: "urgent_check",
  },
  rankedProductIds: [],
  country: "KR",
});
assert.equal(urgent.saved, true);
assert.equal(urgent.sessionCount, 3);

console.log("care auto-save selftest: ok");

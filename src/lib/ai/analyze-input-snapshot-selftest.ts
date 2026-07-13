import {
  analyzeInputSnapshotsEqual,
  normalizeAnalyzeInputSnapshot,
  normalizeRednessForSnapshot,
  type AnalyzeInputSnapshot,
} from "./analyzeInputSnapshot";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[analyze-input-snapshot] ${msg}`);
}

export function runAnalyzeInputSnapshotSelftests(): {
  ok: true;
  checks: number;
} {
  let checks = 0;

  const manualA: AnalyzeInputSnapshot = {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: ["붉은기", "건조함"],
    sensitivity: "보통",
    rednessObservation: null,
  };

  // 1. 동일 입력 일치
  assert(
    analyzeInputSnapshotsEqual(manualA, { ...manualA }),
    "identical match"
  );
  checks += 1;

  // 2. 고민 변경 시 불일치 (순서 포함)
  assert(
    !analyzeInputSnapshotsEqual(manualA, {
      ...manualA,
      concerns: ["건조함", "붉은기"],
    }),
    "concern order matters"
  );
  assert(
    !analyzeInputSnapshotsEqual(manualA, {
      ...manualA,
      concerns: ["붉은기"],
    }),
    "concern change mismatch"
  );
  checks += 1;

  // 3. 민감도 변경
  assert(
    !analyzeInputSnapshotsEqual(manualA, {
      ...manualA,
      sensitivity: "민감함",
    }),
    "sensitivity mismatch"
  );
  checks += 1;

  // 4. rednessObservation 변경
  assert(
    !analyzeInputSnapshotsEqual(manualA, {
      ...manualA,
      rednessObservation: { duration: "persistent", symptoms: ["burning"] },
    }),
    "redness mismatch"
  );
  checks += 1;

  // 5. 빈 optional 정규화
  assert(
    normalizeRednessForSnapshot({}) === null,
    "empty object → null"
  );
  assert(
    normalizeRednessForSnapshot({ symptoms: [], areas: [] }) === null,
    "empty arrays → null"
  );
  assert(
    analyzeInputSnapshotsEqual(
      { ...manualA, rednessObservation: null },
      { ...manualA, rednessObservation: {} as AnalyzeInputSnapshot["rednessObservation"] }
    ),
    "empty redness equals null"
  );
  checks += 1;

  // 6. 구버전 snapshot 호환
  assert(
    normalizeAnalyzeInputSnapshot({
      mode: "manual",
      skinTone: " 중간 ",
      undertone: "중립",
      concerns: ["붉은기"],
      sensitivity: "보통",
    }) != null,
    "legacy without redness loads"
  );
  assert(
    normalizeAnalyzeInputSnapshot({ mode: "manual" } as never) != null,
    "minimal manual snapshot loads"
  );
  assert(normalizeAnalyzeInputSnapshot(null) === null, "null stays null");
  assert(
    normalizeAnalyzeInputSnapshot({ mode: "other" as "manual" }) === null,
    "invalid mode rejected"
  );
  checks += 1;

  const photo: AnalyzeInputSnapshot = {
    mode: "photo",
    skinTone: "",
    undertone: "",
    concerns: [],
    sensitivity: "",
    rednessObservation: null,
  };
  assert(
    analyzeInputSnapshotsEqual(photo, {
      ...photo,
      skinTone: "ignored",
    }),
    "photo ignores manual fields"
  );
  checks += 1;

  return { ok: true, checks };
}

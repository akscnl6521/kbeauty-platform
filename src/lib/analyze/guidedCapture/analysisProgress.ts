/**
 * AI analysis waiting UX — progress phases and soft percent curve.
 * Never invent analysis scores. Cap below 100 until real completion.
 */

import type { AnalysisProgressPhase } from "./types";

export type AnalysisProgressSnapshot = {
  phase: AnalysisProgressPhase;
  /** 0–100; reaches 100 only when phase is completed. */
  percent: number;
  elapsedMs: number;
  delayHint: "none" | "normal" | "slow";
  /** Phases that truly finished (local/API), not speculative. */
  completedPhases: AnalysisProgressPhase[];
  messageKo: string;
  requestId: string | null;
  inFlight: boolean;
};

export const ANALYSIS_TIMEOUT_MS = 60_000;
export const DELAY_HINT_NORMAL_MS = 12_000;
export const DELAY_HINT_SLOW_MS = 30_000;

export function messageForPhase(phase: AnalysisProgressPhase): string {
  switch (phase) {
    case "preparing":
      return "분석을 준비하고 있어요.";
    case "checking_photo_quality":
      return "촬영한 사진의 품질을 확인하고 있어요.";
    case "uploading":
      return "사진을 안전하게 전달하고 있어요.";
    case "analyzing":
      return "얼굴 영역을 구분하고 문진 답변과 함께 비교하고 있어요.";
    case "matching_scenario":
      return "피부 고민에 맞는 상황을 확인하고 있어요.";
    case "checking_ingredients":
      return "피부 고민에 맞는 성분을 확인하고 있어요.";
    case "ranking_products":
      return "검증된 제품 후보를 비교하고 있어요.";
    case "building_routine":
      return "개인 루틴을 만들고 있어요.";
    case "saving_result":
      return "결과를 정리하고 있어요.";
    case "completed":
      return "분석이 완료됐어요.";
    case "failed":
      return "분석을 완료하지 못했어요. 다시 시도하거나 문진만으로 계속할 수 있어요.";
    case "timed_out":
      return "응답이 지연되어 중단했어요. 다시 분석하거나 문진만으로 계속해 주세요.";
  }
}

export function delayHintForElapsed(elapsedMs: number): "none" | "normal" | "slow" {
  if (elapsedMs >= DELAY_HINT_SLOW_MS) return "slow";
  if (elapsedMs >= DELAY_HINT_NORMAL_MS) return "normal";
  return "none";
}

export function delayMessageKo(hint: "none" | "normal" | "slow"): string | null {
  if (hint === "normal") return "분석이 정상적으로 진행 중입니다.";
  if (hint === "slow") return "평소보다 조금 오래 걸리고 있어요.";
  return null;
}

/**
 * Soft progress while waiting on API.
 * 0–20 fast, 20–75 natural, 75–90 slow — never reaches 100 here.
 */
export function softProgressPercent(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  if (t <= 2_000) {
    return Math.min(20, (t / 2_000) * 20);
  }
  if (t <= 15_000) {
    const u = (t - 2_000) / 13_000;
    return 20 + u * 55;
  }
  if (t <= 45_000) {
    const u = (t - 15_000) / 30_000;
    return 75 + u * 15;
  }
  return 90;
}

export function createInitialProgress(
  requestId: string | null
): AnalysisProgressSnapshot {
  return {
    phase: "preparing",
    percent: 0,
    elapsedMs: 0,
    delayHint: "none",
    completedPhases: [],
    messageKo: messageForPhase("preparing"),
    requestId,
    inFlight: true,
  };
}

export function advanceLocalPhase(
  prev: AnalysisProgressSnapshot,
  phase: AnalysisProgressPhase,
  elapsedMs: number
): AnalysisProgressSnapshot {
  if (
    prev.phase === "completed" ||
    prev.phase === "failed" ||
    prev.phase === "timed_out"
  ) {
    return prev;
  }
  const completed = [...prev.completedPhases];
  if (prev.phase !== phase && !completed.includes(prev.phase)) {
    completed.push(prev.phase);
  }
  const capped = softProgressPercent(elapsedMs);
  return {
    ...prev,
    phase,
    percent: Math.min(90, Math.max(prev.percent, capped)),
    elapsedMs,
    delayHint: delayHintForElapsed(elapsedMs),
    completedPhases: completed,
    messageKo: messageForPhase(phase),
    inFlight: true,
  };
}

export function tickWaitingProgress(
  prev: AnalysisProgressSnapshot,
  elapsedMs: number
): AnalysisProgressSnapshot {
  if (!prev.inFlight) return { ...prev, elapsedMs };
  if (
    prev.phase === "completed" ||
    prev.phase === "failed" ||
    prev.phase === "timed_out"
  ) {
    return prev;
  }
  const nextPercent = Math.max(prev.percent, softProgressPercent(elapsedMs));
  return {
    ...prev,
    percent: Math.min(90, nextPercent),
    elapsedMs,
    delayHint: delayHintForElapsed(elapsedMs),
  };
}

export function markCompleted(
  prev: AnalysisProgressSnapshot,
  finalCompleted: AnalysisProgressPhase[]
): AnalysisProgressSnapshot {
  return {
    ...prev,
    phase: "completed",
    percent: 100,
    completedPhases: finalCompleted,
    messageKo: messageForPhase("completed"),
    inFlight: false,
    delayHint: "none",
  };
}

export function markFailed(
  prev: AnalysisProgressSnapshot,
  kind: "failed" | "timed_out"
): AnalysisProgressSnapshot {
  return {
    ...prev,
    phase: kind,
    percent: Math.min(prev.percent, 90),
    messageKo: messageForPhase(kind),
    inFlight: false,
  };
}

/** Guard: percent must not be 100 before completion. */
export function assertProgressInvariant(snap: AnalysisProgressSnapshot): boolean {
  if (snap.phase === "completed") return snap.percent === 100;
  return snap.percent < 100;
}

/** Block while any analyze request is in flight (idempotent UI guard). */
export function shouldBlockDuplicateAnalyze(input: {
  inFlight: boolean;
}): boolean {
  return input.inFlight;
}

export function canStartAnalyze(input: {
  inFlight: boolean;
}): boolean {
  return !input.inFlight;
}

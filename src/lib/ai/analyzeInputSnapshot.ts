/**
 * 분석 성공 시점의 사용자 입력 스냅샷.
 * 폼 변경 후 이전 AI 결과·랭킹이 stale로 섞이는 것을 막는다.
 * (표시/네비게이션 동기화만 — rankProducts·점수·offer 변경 없음)
 */

import type { RednessObservation } from "./rednessObservation";

export const ANALYZE_INPUT_SNAPSHOT_KEY = "skinAnalyzeInputSnapshot";

export type AnalyzeInputSnapshot = {
  mode: "photo" | "manual";
  skinTone: string;
  undertone: string;
  concerns: string[];
  sensitivity: string;
  rednessObservation: RednessObservation | null;
};

/** 빈 배열·빈 객체를 null로 정규화 (구버전·부분 입력 호환) */
export function normalizeRednessForSnapshot(
  value: RednessObservation | null | undefined
): RednessObservation | null {
  if (!value || typeof value !== "object") return null;
  const symptoms = Array.isArray(value.symptoms)
    ? value.symptoms.filter(Boolean)
    : [];
  const areas = Array.isArray(value.areas)
    ? value.areas.filter(Boolean)
    : [];
  const out: RednessObservation = {};
  if (value.trigger) out.trigger = value.trigger;
  if (symptoms.length > 0) out.symptoms = [...symptoms].sort();
  if (value.duration) out.duration = value.duration;
  if (areas.length > 0) out.areas = [...areas].sort();
  if (!out.trigger && !out.symptoms && !out.duration && !out.areas) {
    return null;
  }
  return out;
}

function stableRednessKey(
  value: RednessObservation | null | undefined
): string {
  const normalized = normalizeRednessForSnapshot(value);
  if (!normalized) return "";
  try {
    return JSON.stringify(normalized);
  } catch {
    return "";
  }
}

export function normalizeAnalyzeInputSnapshot(
  raw: Partial<AnalyzeInputSnapshot> | null | undefined
): AnalyzeInputSnapshot | null {
  if (!raw || (raw.mode !== "photo" && raw.mode !== "manual")) return null;
  return {
    mode: raw.mode,
    skinTone: typeof raw.skinTone === "string" ? raw.skinTone.trim() : "",
    undertone: typeof raw.undertone === "string" ? raw.undertone.trim() : "",
    concerns: Array.isArray(raw.concerns)
      ? raw.concerns.map(String).map((s) => s.trim()).filter(Boolean)
      : [],
    sensitivity:
      typeof raw.sensitivity === "string" ? raw.sensitivity.trim() : "",
    rednessObservation: normalizeRednessForSnapshot(
      raw.rednessObservation ?? null
    ),
  };
}

export function analyzeInputSnapshotsEqual(
  a: AnalyzeInputSnapshot | null | undefined,
  b: AnalyzeInputSnapshot | null | undefined
): boolean {
  const na = normalizeAnalyzeInputSnapshot(a ?? null);
  const nb = normalizeAnalyzeInputSnapshot(b ?? null);
  if (!na || !nb) return false;
  if (na.mode !== nb.mode) return false;
  if (na.mode === "photo") return true;
  if (na.skinTone !== nb.skinTone) return false;
  if (na.undertone !== nb.undertone) return false;
  if (na.sensitivity !== nb.sensitivity) return false;
  // 고민 선택 순서 유지
  if (na.concerns.length !== nb.concerns.length) return false;
  for (let i = 0; i < na.concerns.length; i++) {
    if (na.concerns[i] !== nb.concerns[i]) return false;
  }
  return (
    stableRednessKey(na.rednessObservation) ===
    stableRednessKey(nb.rednessObservation)
  );
}

export function loadAnalyzeInputSnapshot(): AnalyzeInputSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYZE_INPUT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AnalyzeInputSnapshot>;
    return normalizeAnalyzeInputSnapshot(parsed);
  } catch {
    return null;
  }
}

export function saveAnalyzeInputSnapshot(
  snapshot: AnalyzeInputSnapshot
): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeAnalyzeInputSnapshot(snapshot);
  if (!normalized) return;
  try {
    window.localStorage.setItem(
      ANALYZE_INPUT_SNAPSHOT_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // ignore quota
  }
}

export function clearAnalyzeInputSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANALYZE_INPUT_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

"use client";

import {
  delayMessageKo,
  type AnalysisProgressSnapshot,
} from "@/lib/analyze/guidedCapture/analysisProgress";
import { ANALYSIS_SCOPE_COPY_KO } from "@/lib/analyze/guidedCapture/inputPolicy";
import {
  ANALYSIS_PIPELINE_PHASES,
  type AnalysisProgressPhase,
} from "@/lib/analyze/guidedCapture/types";

const PHASE_LABEL: Record<AnalysisProgressPhase, string> = {
  preparing: "준비",
  checking_photo_quality: "사진 품질",
  uploading: "요청 전송",
  analyzing: "안내 준비",
  matching_scenario: "상황 매칭",
  checking_ingredients: "성분 확인",
  ranking_products: "제품 비교",
  building_routine: "루틴",
  saving_result: "결과 정리",
  completed: "완료",
  failed: "실패",
  timed_out: "시간 초과",
};

export type AnalysisProgressOverlayProps = {
  progress: AnalysisProgressSnapshot;
  reducedMotion?: boolean;
  onRetry?: () => void;
  onRetakeFailed?: () => void;
  onContinueManual?: () => void;
  onDismiss?: () => void;
};

export function AnalysisProgressOverlay({
  progress,
  reducedMotion,
  onRetry,
  onRetakeFailed,
  onContinueManual,
  onDismiss,
}: AnalysisProgressOverlayProps) {
  const delayMsg = delayMessageKo(progress.delayHint);
  const terminal =
    progress.phase === "completed" ||
    progress.phase === "failed" ||
    progress.phase === "timed_out";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-progress-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#FAFAF8] p-5 shadow-xl">
        <h2
          id="analysis-progress-title"
          className="font-['Playfair_Display',serif] text-xl text-stone-900"
        >
          {ANALYSIS_SCOPE_COPY_KO.progressTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600" aria-live="polite">
          {progress.messageKo}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-stone-500">
          {ANALYSIS_SCOPE_COPY_KO.noExternalVision}
        </p>
        {delayMsg ? (
          <p className="mt-2 text-xs text-stone-500" role="status">
            {delayMsg}
          </p>
        ) : null}

        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-stone-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.percent)}
          >
            <div
              className={`h-full rounded-full bg-[#C2185B] ${
                reducedMotion ? "" : "transition-[width] duration-500 ease-out"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-stone-500">
            {Math.round(progress.percent)}%
          </p>
        </div>

        <ul className="mt-4 space-y-1.5">
          {ANALYSIS_PIPELINE_PHASES.map((phase) => {
            const done = progress.completedPhases.includes(phase);
            const current = progress.phase === phase;
            return (
              <li
                key={phase}
                className={`flex items-center gap-2 text-xs ${
                  current
                    ? "font-semibold text-[#C2185B]"
                    : done
                      ? "text-emerald-800"
                      : "text-stone-400"
                }`}
              >
                <span aria-hidden>{done ? "✓" : current ? "●" : "○"}</span>
                <span>{PHASE_LABEL[phase]}</span>
                {!done && !current ? (
                  <span className="sr-only">아직 시작하지 않음</span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-[11px] leading-5 text-stone-500">
          진행 표시는 대기 안내입니다. 홍조 수치·피부 나이·질환 판정 같은 임의
          결과는 표시하지 않습니다.
        </p>

        {terminal && progress.phase !== "completed" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full bg-[#C2185B] px-4 py-2 text-xs font-semibold text-white"
              >
                다시 분석
              </button>
            ) : null}
            {onRetakeFailed ? (
              <button
                type="button"
                onClick={onRetakeFailed}
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
              >
                사진 다시 촬영
              </button>
            ) : null}
            {onContinueManual ? (
              <button
                type="button"
                onClick={onContinueManual}
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
              >
                문진만으로 계속하기
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-transparent px-3 py-2 text-xs text-stone-500"
              >
                닫기
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

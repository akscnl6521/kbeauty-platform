"use client";

import { useMemo, useState } from "react";
import { ANALYSIS_SCOPE_COPY_KO } from "@/lib/analyze/guidedCapture/inputPolicy";
import {
  defaultPhotoConsentChoices,
  medicalDisclaimerKo,
  retentionNoticeKo,
  validatePhotoConsentChoices,
  type PhotoConsentChoices,
  type PhotoConsentMode,
} from "@/lib/care/photoComparisonPolicy";

export type PhotoConsentPanelProps = {
  value?: PhotoConsentChoices;
  onChange?: (choices: PhotoConsentChoices, mode: PhotoConsentMode) => void;
  compact?: boolean;
};

export function PhotoConsentPanel({
  value,
  onChange,
  compact = false,
}: PhotoConsentPanelProps) {
  const [local, setLocal] = useState<PhotoConsentChoices>(
    value ?? defaultPhotoConsentChoices()
  );

  const choices = value ?? local;
  const validation = useMemo(() => validatePhotoConsentChoices(choices), [choices]);

  function patch(partial: Partial<PhotoConsentChoices>) {
    const next = { ...choices, ...partial };
    if (!next.saveForComparison) {
      next.learningOptIn = false;
    }
    if (value) {
      onChange?.(next, validatePhotoConsentChoices(next).effectiveMode);
    } else {
      setLocal(next);
      onChange?.(next, validatePhotoConsentChoices(next).effectiveMode);
    }
  }

  const mode: PhotoConsentMode = validation.effectiveMode;

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-pink-100 bg-pink-50/30 p-3 text-xs"
          : "rounded-2xl border border-[#E8DFD8] bg-white p-4 text-sm"
      }
    >
      <h3 className="font-semibold text-gray-900">사진 사용 동의</h3>
      <p className="mt-2 text-xs leading-5 text-gray-600">{retentionNoticeKo}</p>

      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">사진 저장 방식</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="photo-consent-mode"
            checked={mode === "analysis_only"}
            onChange={() =>
              patch({
                saveForComparison: false,
                learningOptIn: false,
                retentionAcknowledged: false,
              })
            }
          />
          <span>
            <span className="font-medium">안내만 (저장하지 않음)</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              {ANALYSIS_SCOPE_COPY_KO.analysisOnlyDetail}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="photo-consent-mode"
            checked={mode === "save_for_comparison"}
            onChange={() => patch({ saveForComparison: true })}
          />
          <span>
            <span className="font-medium">비교용으로 저장</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              이후 변화 비교를 위해 최대 90일 보관합니다. 설정에서 언제든 삭제할 수 있습니다.
            </span>
          </span>
        </label>
      </fieldset>

      {choices.saveForComparison ? (
        <label className="mt-3 flex items-start gap-2">
          <input
            type="checkbox"
            checked={choices.retentionAcknowledged}
            onChange={(e) => patch({ retentionAcknowledged: e.target.checked })}
          />
          <span className="text-xs text-gray-700">
            보관 기간(최대 90일)과 언제든 삭제 가능함을 확인했습니다.
          </span>
        </label>
      ) : null}

      <label className="mt-3 flex items-start gap-2">
        <input
          type="checkbox"
          checked={choices.analysisConsent}
          onChange={(e) => patch({ analysisConsent: e.target.checked })}
        />
        <span className="text-xs text-gray-700">
          {ANALYSIS_SCOPE_COPY_KO.consentAnalysisLabel}
        </span>
      </label>

      <label className="mt-2 flex items-start gap-2">
        <input
          type="checkbox"
          checked={choices.learningOptIn}
          disabled={!choices.saveForComparison}
          onChange={(e) => patch({ learningOptIn: e.target.checked })}
        />
        <span className="text-xs text-gray-700">
          (선택) 익명화된 학습·품질 개선에 활용하는 것에 동의합니다. 저장 동의 없이는 선택할 수 없습니다.
        </span>
      </label>

      <p className="mt-3 text-xs leading-5 text-amber-800">{medicalDisclaimerKo}</p>
      {!validation.ok && choices.analysisConsent ? (
        <p className="mt-2 text-xs text-rose-700" role="alert">
          동의 항목을 확인해 주세요.
        </p>
      ) : null}
    </div>
  );
}

export function photoConsentBlockedMessage(choices: PhotoConsentChoices): string | null {
  const validation = validatePhotoConsentChoices(choices);
  if (!choices.analysisConsent) {
    return ANALYSIS_SCOPE_COPY_KO.consentBlocked;
  }
  if (choices.saveForComparison && !validation.ok) {
    return "비교용 저장을 선택했다면 보관 안내 확인이 필요합니다.";
  }
  return null;
}

export function photoAnalysisOnlyAckMessage(): string {
  return ANALYSIS_SCOPE_COPY_KO.analysisOnlyAck;
}

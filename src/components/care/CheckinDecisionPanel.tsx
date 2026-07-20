"use client";

import type {
  CheckinDecision,
  CheckinLocale,
} from "@/lib/retention/checkinPolicy";
import {
  getCheckinActionLabel,
  getCheckinResponseLabel,
} from "@/lib/retention/checkinCopy";

type Props = {
  decision: CheckinDecision;
  locale?: CheckinLocale;
  showConsultationBanner?: boolean;
};

export function CheckinDecisionPanel({
  decision,
  locale = "ko",
  showConsultationBanner = true,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-[#E8DFD8] bg-white p-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          응답 요약
        </p>
        <p className="mt-1 font-semibold text-gray-900">
          {getCheckinResponseLabel(decision.response, locale)}
        </p>
      </div>

      {showConsultationBanner && decision.prioritizeConsultation ? (
        <p
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 font-medium text-rose-900"
          role="alert"
        >
          현재 응답에는 신속한 확인이 권장되는 신호가 포함되어 있습니다. 새
          제품 사용보다 가까운 의료기관·전문가 확인을 우선하세요. 이 안내는
          진단이 아닙니다.
        </p>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          다음 행동
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-800">
          {decision.actions.map((action) => (
            <li key={action}>{getCheckinActionLabel(action, locale)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

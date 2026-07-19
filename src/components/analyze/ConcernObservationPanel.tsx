"use client";

import { ConcernObservationFields } from "@/components/analyze/ConcernObservationFields";
import {
  normalizeConcernObservationMap,
  updateConcernObservation,
  type ConcernObservationMap,
} from "@/lib/ai/concernObservationFormState";

const CONCERN_PARAM_LABELS: Record<string, string> = {
  Redness: "붉은기",
  Dryness: "건조함",
  Acne: "여드름",
  Pigmentation: "색소침착",
  "Anti-aging": "주름",
  Pores: "모공",
  UV: "자외선",
};

export function ConcernObservationPanel(props: {
  concerns: string[];
  value: ConcernObservationMap;
  onChange: (next: ConcernObservationMap) => void;
}) {
  const normalized = normalizeConcernObservationMap(props.concerns, props.value);

  if (props.concerns.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-pink-100 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">고민별 상세 상태</h2>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          선택한 고민마다 부위·심각도·지속 기간·악화 여부를 입력하면 추천 범위와 상담 필요도를 더 정확히 구분합니다.
        </p>
      </div>

      {props.concerns.map((concern) => (
        <ConcernObservationFields
          key={concern}
          concern={CONCERN_PARAM_LABELS[concern] ?? concern}
          value={{ concern, ...(normalized[concern] ?? {}) }}
          onChange={(observation) => {
            const { concern: _ignored, ...draft } = observation;
            props.onChange(updateConcernObservation(normalized, concern, draft));
          }}
        />
      ))}
    </section>
  );
}

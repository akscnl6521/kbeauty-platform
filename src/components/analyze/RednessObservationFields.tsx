"use client";

import {
  REDNESS_AREAS,
  REDNESS_AREA_LABEL_KO,
  REDNESS_DURATION_LABEL_KO,
  REDNESS_DURATIONS,
  REDNESS_SYMPTOM_LABEL_KO,
  REDNESS_SYMPTOMS,
  REDNESS_TRIGGER_LABEL_KO,
  REDNESS_TRIGGERS,
  type RednessArea,
  type RednessDuration,
  type RednessObservation,
  type RednessSymptom,
  type RednessTrigger,
} from "@/lib/ai/rednessObservation";

type Props = {
  value: RednessObservation;
  onChange: (next: RednessObservation) => void;
};

function ChipButton(props: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
        props.selected
          ? "bg-[#C2185B] text-white"
          : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
      }`}
    >
      {props.label}
    </button>
  );
}

/**
 * 붉은기 선택 시 표시되는 관찰용 2차 질문 (진단 아님, 전부 선택 사항).
 */
export function RednessObservationFields({ value, onChange }: Props) {
  const setTrigger = (trigger: RednessTrigger) => {
    onChange({
      ...value,
      trigger: value.trigger === trigger ? undefined : trigger,
    });
  };

  const toggleSymptom = (symptom: RednessSymptom) => {
    const current = value.symptoms ?? [];
    if (symptom === "none") {
      onChange({
        ...value,
        symptoms: current.includes("none") ? undefined : ["none"],
      });
      return;
    }
    const withoutNone = current.filter((s) => s !== "none");
    const next = withoutNone.includes(symptom)
      ? withoutNone.filter((s) => s !== symptom)
      : [...withoutNone, symptom];
    onChange({
      ...value,
      symptoms: next.length > 0 ? next : undefined,
    });
  };

  const setDuration = (duration: RednessDuration) => {
    onChange({
      ...value,
      duration: value.duration === duration ? undefined : duration,
    });
  };

  const toggleArea = (area: RednessArea) => {
    const current = value.areas ?? [];
    const next = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    onChange({
      ...value,
      areas: next.length > 0 ? next : undefined,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">붉은기 자세히 (선택)</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          붉어 보이는 상태가 언제, 어떤 상황에서 나타나는지 알려주세요. 원인을
          진단하기 위한 질문이 아니며, 비워 두어도 분석할 수 있습니다.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-gray-800">붉어지는 상황</p>
        <div className="flex flex-wrap gap-2">
          {REDNESS_TRIGGERS.map((t) => (
            <ChipButton
              key={t}
              selected={value.trigger === t}
              label={REDNESS_TRIGGER_LABEL_KO[t]}
              onClick={() => setTrigger(t)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-gray-800">함께 느끼는 증상</p>
        <div className="flex flex-wrap gap-2">
          {REDNESS_SYMPTOMS.map((s) => (
            <ChipButton
              key={s}
              selected={(value.symptoms ?? []).includes(s)}
              label={REDNESS_SYMPTOM_LABEL_KO[s]}
              onClick={() => toggleSymptom(s)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-gray-800">지속 시간</p>
        <div className="flex flex-wrap gap-2">
          {REDNESS_DURATIONS.map((d) => (
            <ChipButton
              key={d}
              selected={value.duration === d}
              label={REDNESS_DURATION_LABEL_KO[d]}
              onClick={() => setDuration(d)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-gray-800">주로 나타나는 부위</p>
        <div className="flex flex-wrap gap-2">
          {REDNESS_AREAS.map((a) => (
            <ChipButton
              key={a}
              selected={(value.areas ?? []).includes(a)}
              label={REDNESS_AREA_LABEL_KO[a]}
              onClick={() => toggleArea(a)}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-500">
        입력하신 내용은 붉어 보이는 피부 상태에 대한 참고 정보이며, 원인을
        진단한 결과는 아닙니다.
      </p>
    </div>
  );
}

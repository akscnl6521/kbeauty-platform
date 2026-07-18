"use client";

import type {
  BodyArea,
  ConcernObservation,
  RedFlag,
  SymptomDuration,
  SymptomSeverity,
} from "@/lib/ai/types";

const AREA_OPTIONS: { value: BodyArea; label: string }[] = [
  { value: "forehead", label: "이마" },
  { value: "eye_area", label: "눈가" },
  { value: "under_eye", label: "눈 밑" },
  { value: "nose", label: "코" },
  { value: "cheek", label: "볼" },
  { value: "mouth_area", label: "입가" },
  { value: "chin", label: "턱" },
  { value: "neck", label: "목" },
  { value: "other", label: "기타" },
];

const SEVERITY_OPTIONS: { value: SymptomSeverity; label: string }[] = [
  { value: "mild", label: "가벼움" },
  { value: "moderate", label: "중간" },
  { value: "severe", label: "심함" },
];

const DURATION_OPTIONS: { value: SymptomDuration; label: string }[] = [
  { value: "under_3_days", label: "3일 미만" },
  { value: "under_2_weeks", label: "2주 미만" },
  { value: "under_3_months", label: "3개월 미만" },
  { value: "over_3_months", label: "3개월 이상" },
  { value: "unknown", label: "잘 모르겠음" },
];

const RED_FLAG_OPTIONS: { value: RedFlag; label: string }[] = [
  { value: "pain", label: "통증" },
  { value: "bleeding", label: "출혈" },
  { value: "oozing", label: "진물" },
  { value: "rapid_swelling", label: "급격한 부기" },
  { value: "spreading_rash", label: "퍼지는 발진" },
  { value: "suspected_infection", label: "감염 의심" },
  { value: "burn", label: "화상" },
  { value: "sudden_mole_change", label: "갑작스러운 점 변화" },
  { value: "eye_irritation", label: "눈 내부 자극" },
  { value: "ear_internal_symptom", label: "귀 내부 증상" },
  { value: "breathing_difficulty", label: "호흡 곤란" },
  { value: "systemic_allergy", label: "전신 알레르기 반응" },
];

function toggleValue<T extends string>(values: T[] | undefined, value: T): T[] {
  const current = values ?? [];
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export function ConcernObservationFields(props: {
  concern: string;
  value: ConcernObservation;
  onChange: (next: ConcernObservation) => void;
}) {
  const { concern, value, onChange } = props;

  return (
    <section className="space-y-4 rounded-2xl border border-pink-100 bg-pink-50/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{concern} 상세 확인</h3>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          진단이 아니라 추천 범위와 상담 필요도를 판단하기 위한 자가 입력입니다.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-gray-800">발생 부위</legend>
        <div className="flex flex-wrap gap-2">
          {AREA_OPTIONS.map((option) => {
            const selected = value.areas?.includes(option.value) ?? false;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onChange({ ...value, areas: toggleValue(value.areas, option.value) })
                }
                className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${
                  selected
                    ? "border-[#C2185B] bg-[#C2185B] text-white"
                    : "border-pink-200 bg-white text-gray-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-800">심각도</span>
          <select
            value={value.severity ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                severity: event.target.value
                  ? (event.target.value as SymptomSeverity)
                  : undefined,
              })
            }
            className="min-h-11 w-full rounded-xl border border-pink-200 bg-white px-3 text-sm text-gray-900"
          >
            <option value="">선택 안 함</option>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-800">발생 기간</span>
          <select
            value={value.duration ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                duration: event.target.value
                  ? (event.target.value as SymptomDuration)
                  : undefined,
              })
            }
            className="min-h-11 w-full rounded-xl border border-pink-200 bg-white px-3 text-sm text-gray-900"
          >
            <option value="">선택 안 함</option>
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-pink-100 bg-white px-3 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value.worsening ?? false}
          onChange={(event) => onChange({ ...value, worsening: event.target.checked })}
          className="h-4 w-4"
        />
        최근 더 심해지고 있음
      </label>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-gray-800">
          즉시 확인이 필요한 증상
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RED_FLAG_OPTIONS.map((option) => {
            const selected = value.redFlags?.includes(option.value) ?? false;
            return (
              <label
                key={option.value}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-red-100 bg-white px-3 text-xs text-gray-800"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    onChange({
                      ...value,
                      redFlags: toggleValue(value.redFlags, option.value),
                    })
                  }
                  className="h-4 w-4"
                />
                {option.label}
              </label>
            );
          })}
        </div>
        {(value.redFlags?.length ?? 0) > 0 ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            선택한 증상에 따라 제품 추천보다 의료기관 확인 안내가 먼저 표시될 수 있습니다.
          </p>
        ) : null}
      </fieldset>
    </section>
  );
}

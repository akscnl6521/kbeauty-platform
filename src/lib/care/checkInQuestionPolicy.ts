import type { CareCheckInDay, CareCheckInAnswers } from "./types";

export type CheckInMetricKey = Exclude<
  keyof CareCheckInAnswers,
  "stillUsing" | "photoAttached" | "freeMemo" | "acuteSignals"
>;

export type CheckInMetricDefinition = {
  key: CheckInMetricKey;
  label: string;
  helper: string;
};

export type CheckInQuestionPolicy = {
  title: string;
  purpose: string;
  stillUsingLabel: string;
  metrics: CheckInMetricDefinition[];
  memoPrompt: string;
};

const IRRITATION_METRICS: CheckInMetricDefinition[] = [
  { key: "sting", label: "따가움", helper: "제품 사용 직후 또는 평소보다 따가운 정도" },
  { key: "itch", label: "가려움", helper: "긁고 싶거나 불편한 정도" },
  { key: "redness", label: "붉음", helper: "평소보다 붉어 보이는 정도" },
  { key: "swelling", label: "붓기", helper: "눈가·입가·얼굴이 붓는 정도" },
  { key: "peeling", label: "벗겨짐", helper: "각질이 심하게 일어나거나 벗겨지는 정도" },
];

const BALANCE_METRICS: CheckInMetricDefinition[] = [
  { key: "dryness", label: "건조", helper: "당김·거칠음·보습 부족 정도" },
  { key: "oiliness", label: "유분", helper: "번들거림이나 피지 증가 정도" },
  { key: "breakouts", label: "트러블", helper: "새 뾰루지·면포·염증 증가 정도" },
];

const EXPERIENCE_METRICS: CheckInMetricDefinition[] = [
  { key: "satisfaction", label: "만족도", helper: "현재 루틴 전반에 대한 만족도" },
  { key: "adherence", label: "루틴 준수", helper: "계획한 횟수대로 사용한 정도" },
];

export function getCheckInQuestionPolicy(day: CareCheckInDay): CheckInQuestionPolicy {
  if (day === 3) {
    return {
      title: "초기 자극과 적응 확인",
      purpose: "새 루틴을 시작한 뒤 즉시 나타난 자극, 붓기, 사용 중단 여부를 먼저 확인합니다.",
      stillUsingLabel: "현재도 같은 루틴을 계속 사용 중",
      metrics: [...IRRITATION_METRICS, ...BALANCE_METRICS, { key: "adherence", label: "루틴 준수", helper: "지난 3일 동안 계획대로 사용한 정도" }],
      memoPrompt: "중단한 제품, 사용 직후 반응, 특이사항을 적어 주세요.",
    };
  }

  if (day === 7) {
    return {
      title: "일주일 적응과 사용 습관 확인",
      purpose: "초기 자극이 줄었는지, 건조·유분 균형과 트러블 변화, 실제 사용 습관을 확인합니다.",
      stillUsingLabel: "현재도 같은 루틴을 계속 사용 중",
      metrics: [...IRRITATION_METRICS, ...BALANCE_METRICS, ...EXPERIENCE_METRICS],
      memoPrompt: "잘 맞았던 단계와 불편했던 제품을 적어 주세요.",
    };
  }

  if (day === 15) {
    return {
      title: "변화 추세와 악화 여부 확인",
      purpose: "2주 동안 증상이 좋아지는지, 비슷한지, 악화되는지 판단할 수 있도록 자극과 피부 균형을 함께 기록합니다.",
      stillUsingLabel: "현재도 같은 루틴을 계속 사용 중",
      metrics: [...BALANCE_METRICS, ...IRRITATION_METRICS, ...EXPERIENCE_METRICS],
      memoPrompt: "처음보다 좋아진 점, 나빠진 점, 새로 생긴 변화를 적어 주세요.",
    };
  }

  return {
    title: "한 달 결과와 다음 단계 결정",
    purpose: "한 달 동안 지속 가능한 루틴인지, 만족도와 증상 변화가 충분한지 확인하고 유지·조정·상담 여부를 결정합니다.",
    stillUsingLabel: "한 달 동안 현재 루틴을 유지함",
    metrics: [...EXPERIENCE_METRICS, ...BALANCE_METRICS, ...IRRITATION_METRICS],
    memoPrompt: "계속 사용할 제품, 중단할 제품, 전문가에게 묻고 싶은 내용을 적어 주세요.",
  };
}

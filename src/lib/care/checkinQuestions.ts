/**
 * Day-differentiated check-in questions (common + day-specific).
 * Keep short: step UI uses these labels; values map into CareCheckInAnswers.
 */

import type { CareCheckInDay } from "@/lib/care/types";

export type CheckinQuestionKind =
  | "slider"
  | "boolean"
  | "memo"
  | "emergency_flags";

export type CheckinQuestion = {
  id: string;
  kind: CheckinQuestionKind;
  label: string;
  help?: string;
  /** Maps to CareCheckInAnswers key when kind is slider/boolean/memo */
  answerKey?:
    | "sting"
    | "itch"
    | "redness"
    | "dryness"
    | "oiliness"
    | "breakouts"
    | "swelling"
    | "peeling"
    | "satisfaction"
    | "adherence"
    | "stillUsing"
    | "freeMemo"
    | "newProductsUsed"
    | "adverseReaction"
    | "usageClarity"
    | "routineFit"
    | "wantReanalysis";
  min?: number;
  max?: number;
};

const COMMON_STEP1: CheckinQuestion[] = [
  {
    id: "stillUsing",
    kind: "boolean",
    label: "추천·루틴 제품을 계속 사용 중인가요?",
    answerKey: "stillUsing",
  },
  {
    id: "adherence",
    kind: "slider",
    label: "루틴을 얼마나 지켰나요?",
    answerKey: "adherence",
    min: 0,
    max: 10,
  },
  {
    id: "satisfaction",
    kind: "slider",
    label: "전반적인 사용 만족도",
    answerKey: "satisfaction",
    min: 0,
    max: 10,
  },
];

const COMMON_SYMPTOMS: CheckinQuestion[] = [
  { id: "dryness", kind: "slider", label: "건조함", answerKey: "dryness", min: 0, max: 10 },
  { id: "redness", kind: "slider", label: "붉은기", answerKey: "redness", min: 0, max: 10 },
  { id: "sting", kind: "slider", label: "따가움·자극", answerKey: "sting", min: 0, max: 10 },
  { id: "breakouts", kind: "slider", label: "트러블", answerKey: "breakouts", min: 0, max: 10 },
  { id: "oiliness", kind: "slider", label: "유분", answerKey: "oiliness", min: 0, max: 10 },
  { id: "swelling", kind: "slider", label: "붓기", answerKey: "swelling", min: 0, max: 10 },
];

const SAFETY: CheckinQuestion[] = [
  {
    id: "emergency_flags",
    kind: "emergency_flags",
    label: "아래 중 해당되는 신호가 있나요? (해당 시 제품 추천보다 안전 안내가 우선됩니다)",
    help: "진단이 아닙니다. 심한 경우 의료기관·응급 도움을 받으세요.",
  },
];

const DAY_EXTRA: Record<CareCheckInDay, CheckinQuestion[]> = {
  3: [
    {
      id: "usageClarity",
      kind: "slider",
      label: "사용법이 명확했나요?",
      answerKey: "usageClarity",
      min: 0,
      max: 10,
      help: "초기 자극·사용 불편을 확인합니다.",
    },
    {
      id: "adverseReaction",
      kind: "boolean",
      label: "알레르기·이상 반응이 있다고 느끼시나요?",
      answerKey: "adverseReaction",
    },
  ],
  7: [
    {
      id: "routineFit",
      kind: "slider",
      label: "루틴에 적응되고 있나요?",
      answerKey: "routineFit",
      min: 0,
      max: 10,
    },
    {
      id: "newProductsUsed",
      kind: "boolean",
      label: "최근 새 제품을 추가했나요?",
      answerKey: "newProductsUsed",
    },
  ],
  15: [
    {
      id: "routineFit",
      kind: "slider",
      label: "이 루틴을 계속 지키기 쉬운가요?",
      answerKey: "routineFit",
      min: 0,
      max: 10,
    },
    {
      id: "wantReanalysis",
      kind: "boolean",
      label: "제품 교체·보완이 필요하다고 느끼시나요?",
      answerKey: "wantReanalysis",
    },
  ],
  30: [
    {
      id: "wantReanalysis",
      kind: "boolean",
      label: "재분석이 필요하다고 느끼시나요?",
      answerKey: "wantReanalysis",
    },
    {
      id: "routineFit",
      kind: "slider",
      label: "한 달 체감 개선 정도",
      answerKey: "routineFit",
      min: 0,
      max: 10,
      help: "악화 또는 변화 없음을 함께 기록합니다.",
    },
  ],
};

export type CheckinStep = {
  id: string;
  title: string;
  questions: CheckinQuestion[];
};

export function getCheckinStepsForDay(day: CareCheckInDay): CheckinStep[] {
  return [
    { id: "basics", title: "기본", questions: COMMON_STEP1 },
    { id: "skin", title: "피부 상태", questions: COMMON_SYMPTOMS },
    {
      id: "day",
      title: `Day ${day} 확인`,
      questions: DAY_EXTRA[day] ?? [],
    },
    { id: "safety", title: "안전 신호", questions: SAFETY },
    {
      id: "memo",
      title: "메모",
      questions: [
        {
          id: "freeMemo",
          kind: "memo",
          label: "자유롭게 적어 주세요 (선택)",
          answerKey: "freeMemo",
        },
        {
          id: "photo",
          kind: "boolean",
          label: "사진 첨부는 이번 단계에서 선택 사항이며, 업로드는 준비 중입니다",
          help: "안전하게 구현되기 전까지 강제하지 않습니다.",
        },
      ],
    },
  ];
}

export function getDayFocusCopy(day: CareCheckInDay): string {
  switch (day) {
    case 3:
      return "초기 자극·사용 불편·이상 반응을 가볍게 확인합니다.";
    case 7:
      return "루틴 적응과 건조·유분·붉은기 변화를 확인합니다.";
    case 15:
      return "중간 변화·만족도·지속 가능성을 확인합니다.";
    case 30:
      return "한 달 요약·재분석·다음 계획 방향을 확인합니다.";
    default:
      return "짧은 체크인으로 상태를 기록합니다.";
  }
}

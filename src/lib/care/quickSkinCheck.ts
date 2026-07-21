/**
 * Lightweight daily skin self-check (no diagnosis).
 */

export type QuickSkinCheckChoice = "better" | "same" | "worse" | "unsure";

export type QuickSkinCheckOption = {
  value: QuickSkinCheckChoice;
  label: string;
};

export const QUICK_SKIN_CHECK_CHOICES: QuickSkinCheckOption[] = [
  { value: "better", label: "좋아졌어요" },
  { value: "same", label: "비슷해요" },
  { value: "worse", label: "나빠졌어요" },
  { value: "unsure", label: "잘 모르겠어요" },
];

export function needsFollowUpQuestions(choice: QuickSkinCheckChoice): boolean {
  return choice === "worse" || choice === "unsure";
}

export function followUpQuestions(choice: QuickSkinCheckChoice): string[] {
  if (choice === "worse") {
    return [
      "붉음·따가움·트러블 중 어떤 변화가 있었나요?",
      "새 제품을 추가하거나 사용량을 바꾸셨나요?",
      "통증·출혈·급격한 붓기가 있다면 체크인 또는 상담 가이드를 확인하세요.",
    ];
  }
  if (choice === "unsure") {
    return [
      "하루 중 특정 시간대에만 불편함이 있나요?",
      "최근 수면·스트레스·환경 변화가 있었나요?",
      "확실하지 않을 때는 정식 체크인 기록이 도움이 됩니다.",
    ];
  }
  return [];
}

export function toProgressNote(choice: QuickSkinCheckChoice): string {
  switch (choice) {
    case "better":
      return "오늘 자가 체크: 전반적으로 나아짐";
    case "same":
      return "오늘 자가 체크: 큰 변화 없음";
    case "worse":
      return "오늘 자가 체크: 악화 느낌";
    case "unsure":
      return "오늘 자가 체크: 변화 불확실";
    default:
      return "오늘 자가 체크";
  }
}

import type { CareFeedback } from "@/lib/care/types";

export type ProductFeedbackSummary = {
  total: number;
  used: number;
  purchased: number;
  irritation: number;
  repurchaseYes: number;
  averageSatisfaction: number | null;
};

export function summarizeProductFeedback(
  feedback: CareFeedback[]
): ProductFeedbackSummary {
  const satisfactionValues = feedback
    .map((item) => item.satisfaction)
    .filter((value): value is number => typeof value === "number");

  return {
    total: feedback.length,
    used: feedback.filter((item) => item.used === true).length,
    purchased: feedback.filter((item) => item.purchased === true).length,
    irritation: feedback.filter((item) => item.irritation === true).length,
    repurchaseYes: feedback.filter((item) => item.repurchaseIntent === true).length,
    averageSatisfaction:
      satisfactionValues.length > 0
        ? Math.round(
            (satisfactionValues.reduce((sum, value) => sum + value, 0) /
              satisfactionValues.length) *
              10
          ) / 10
        : null,
  };
}

export function productFeedbackSafetyMessage(
  summary: ProductFeedbackSummary
): string | null {
  if (summary.irritation <= 0) return null;
  return `${summary.irritation}개 제품에서 자극 경험이 기록되었습니다. 해당 제품 사용을 재검토하고 지속·악화 시 체크인 또는 전문가 확인을 우선하세요.`;
}

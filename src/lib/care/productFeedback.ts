import type { CareFeedback } from "@/lib/care/types";

export type ProductFeedbackInput = {
  productId: string;
  used: boolean | null;
  purchased: boolean | null;
  satisfaction: number | null;
  irritation: boolean | null;
  stopReason: string | null;
  repurchaseIntent: boolean | null;
  concernChange: string | null;
};

function clampScore(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(10, Math.round(value)));
}

function cleanText(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return cleaned || null;
}

export function buildProductFeedback(
  input: ProductFeedbackInput,
  options: { id: string; createdAt?: string }
): CareFeedback {
  const productId = input.productId.trim();
  if (!productId) throw new Error("productId is required");

  const used = input.used;
  return {
    id: options.id,
    createdAt: options.createdAt ?? new Date().toISOString(),
    productId,
    used,
    purchased: input.purchased,
    satisfaction: used === false ? null : clampScore(input.satisfaction),
    irritation: used === false ? null : input.irritation,
    stopReason:
      used === false || input.irritation === true
        ? cleanText(input.stopReason, 200)
        : null,
    repurchaseIntent: used === false ? null : input.repurchaseIntent,
    concernChange: used === false ? null : cleanText(input.concernChange, 300),
  };
}

export function upsertProductFeedback(
  existing: CareFeedback[],
  next: CareFeedback
): CareFeedback[] {
  const withoutSameProduct = existing.filter(
    (item) => item.productId !== next.productId
  );
  return [next, ...withoutSameProduct].slice(0, 100);
}

export function feedbackCompletionLabel(feedback: CareFeedback | null): string {
  if (!feedback) return "사용 경험 미등록";
  if (feedback.used === false) return "아직 사용하지 않음";
  if (feedback.irritation === true) return "자극 경험 기록됨";
  if (feedback.used === true) return "사용 경험 등록 완료";
  return "사용 여부 확인 필요";
}

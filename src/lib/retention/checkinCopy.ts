import type { CheckinAction, CheckinLocale, CheckinResponse } from "./checkinPolicy";

const RESPONSE_LABELS: Record<
  CheckinLocale,
  Record<CheckinResponse, string>
> = {
  ko: {
    improved: "나아졌어요",
    unchanged: "비슷해요",
    worsened: "악화됐어요",
    not_started: "아직 시작하지 않았어요",
    stopped: "사용을 중단했어요",
    unsure: "잘 모르겠어요",
  },
  en: {
    improved: "Improved",
    unchanged: "About the same",
    worsened: "Worsened",
    not_started: "Haven't started yet",
    stopped: "Stopped using",
    unsure: "Not sure",
  },
  ja: {
    improved: "良くなった",
    unchanged: "あまり変わらない",
    worsened: "悪化した",
    not_started: "まだ始めていない",
    stopped: "使用をやめた",
    unsure: "よく分からない",
  },
};

const ACTION_LABELS: Record<CheckinLocale, Record<CheckinAction, string>> = {
  ko: {
    maintain_routine: "현재 루틴을 유지하세요",
    review_usage_duration: "사용 기간과 기대 범위를 다시 확인하세요",
    review_application_method: "사용법·도포량을 다시 확인하세요",
    review_expectation_range: "효과가 나타나는 시기를 점검하세요",
    consider_routine_adjustment: "필요하면 루틴 조정 후보를 검토하세요",
    pause_new_products: "새로 추가한 제품 사용을 잠시 중단해 보세요",
    simplify_routine: "루틴을 단순화해 자극 가능성을 줄이세요",
    risk_assessment: "위험 신호가 있는지 다시 확인하세요",
    prioritize_consultation: "제품 추천보다 전문가 확인을 우선하세요",
    confirm_not_started_reason: "시작하지 않은 이유를 짧게 기록하세요",
    reschedule_start: "시작일을 다시 정할 수 있습니다",
    record_stop_reason: "중단 이유를 기록해 두세요",
    suggest_comparison: "이전 상태와 간단히 비교해 보세요",
    suggest_photo_or_memo: "사진 또는 메모로 변화를 남겨 보세요",
  },
  en: {
    maintain_routine: "Keep your current routine",
    review_usage_duration: "Review how long you've used products and realistic timelines",
    review_application_method: "Review application method and amount",
    review_expectation_range: "Check whether your expectations match typical timelines",
    consider_routine_adjustment: "Consider routine adjustments if needed",
    pause_new_products: "Pause newly added products for now",
    simplify_routine: "Simplify your routine to reduce irritation risk",
    risk_assessment: "Review whether any warning signs are present",
    prioritize_consultation: "Prioritize professional guidance over product changes",
    confirm_not_started_reason: "Note why you haven't started yet",
    reschedule_start: "You can reset your start date",
    record_stop_reason: "Record why you stopped",
    suggest_comparison: "Compare briefly with how things were before",
    suggest_photo_or_memo: "Consider a photo or short memo to track change",
  },
  ja: {
    maintain_routine: "現在のルーティンを続けてください",
    review_usage_duration: "使用期間と期待できる時期を再確認してください",
    review_application_method: "使い方・量を再確認してください",
    review_expectation_range: "効果が出る目安時期を確認してください",
    consider_routine_adjustment: "必要ならルーティン調整を検討してください",
    pause_new_products: "新しく追加した製品は一旦休止してください",
    simplify_routine: "ルーティンを簡素化して刺激を減らしてください",
    risk_assessment: "危険信号がないか再確認してください",
    prioritize_consultation: "製品変更より専門家への相談を優先してください",
    confirm_not_started_reason: "始めていない理由を短く記録してください",
    reschedule_start: "開始日を再設定できます",
    record_stop_reason: "中断理由を記録してください",
    suggest_comparison: "以前の状態と簡単に比較してください",
    suggest_photo_or_memo: "写真やメモで変化を残すことを検討してください",
  },
};

const STOPPED_REASON_LABELS: Record<
  CheckinLocale,
  Record<string, string>
> = {
  ko: {
    irritation: "자극·불편",
    complexity: "루틴이 복잡함",
    purchase_failed: "구매 실패·품절",
    other: "기타",
  },
  en: {
    irritation: "Irritation or discomfort",
    complexity: "Routine too complex",
    purchase_failed: "Purchase failed or out of stock",
    other: "Other",
  },
  ja: {
    irritation: "刺激・不快感",
    complexity: "ルーティンが複雑",
    purchase_failed: "購入できなかった",
    other: "その他",
  },
};

export function getCheckinResponseLabel(
  response: CheckinResponse,
  locale: CheckinLocale = "ko"
): string {
  return RESPONSE_LABELS[locale][response];
}

export function getCheckinActionLabel(
  action: CheckinAction,
  locale: CheckinLocale = "ko"
): string {
  return ACTION_LABELS[locale][action];
}

export function getStoppedReasonLabel(
  reason: string,
  locale: CheckinLocale = "ko"
): string {
  return STOPPED_REASON_LABELS[locale][reason] ?? reason;
}

export const CHECKIN_RESPONSE_OPTIONS: CheckinResponse[] = [
  "improved",
  "unchanged",
  "worsened",
  "not_started",
  "stopped",
  "unsure",
];

import type {
  CheckinLocale,
} from "@/lib/retention/checkinPolicy";
import type {
  RoutineAdjustmentReason,
  RoutineAdjustmentType,
} from "@/lib/retention/routineAdjustmentPolicy";

const TYPE_LABELS: Record<
  CheckinLocale,
  Record<RoutineAdjustmentType, string>
> = {
  ko: {
    keep_current: "현재 루틴 유지",
    simplify: "루틴 단순화 (선택 일시 중지)",
    pause_recent_product: "최근 추가 제품 일시 중지",
    pause_all_new_products: "새 제품 전체 일시 중지",
    restart_later: "시작일 재설정",
    record_only: "기록만 남기기",
    consultation_first: "상담 우선 (제품 조정 보류)",
  },
  en: {
    keep_current: "Keep current routine",
    simplify: "Simplify routine (pause selected)",
    pause_recent_product: "Pause recently added product",
    pause_all_new_products: "Pause all newer products",
    restart_later: "Reset start date",
    record_only: "Record only",
    consultation_first: "Prioritize consultation",
  },
  ja: {
    keep_current: "現在のルーティンを維持",
    simplify: "ルーティン簡素化（選択一時停止）",
    pause_recent_product: "最近追加した製品を一時停止",
    pause_all_new_products: "新しい製品をすべて一時停止",
    restart_later: "開始日を再設定",
    record_only: "記録のみ",
    consultation_first: "相談を優先",
  },
};

const REASON_LABELS: Record<
  CheckinLocale,
  Record<RoutineAdjustmentReason, string>
> = {
  ko: {
    response_improved: "상태가 나아졌다고 보고하셨으므로 현재 루틴을 유지하는 것이 우선입니다.",
    response_unchanged: "변화가 뚜렷하지 않을 때는 사용 기간·사용법을 확인하고, 필요하면 단순화를 검토합니다.",
    response_worsened: "악화 신호가 있어 최근 추가 제품 중단 또는 루틴 단순화를 검토합니다.",
    response_not_started: "아직 시작하지 않았다면 시작일을 다시 정할 수 있습니다.",
    response_stopped: "중단 이유를 기록하고, 필요하면 단순화 또는 시작일 재설정을 제안합니다.",
    response_unsure: "확신이 없을 때는 제품 변경보다 비교·메모 기록을 권합니다.",
    urgent_risk: "위험 신호가 있어 제품 조정보다 전문가 확인을 우선합니다. 진단이 아닙니다.",
    stopped_irritation: "자극으로 중단하셨다면 기능성 단계부터 단순화를 검토합니다.",
    stopped_complexity: "루틴이 복잡해서 중단하셨다면 단계를 줄이는 것을 검토합니다.",
    recent_products_uncertain: "최근 추가 제품을 자동으로 특정할 수 없어 직접 선택해 주세요.",
    no_routine: "저장된 루틴이 없어 조정안을 적용할 대상이 없습니다.",
  },
  en: {
    response_improved: "You reported improvement, so keeping the current routine is preferred.",
    response_unchanged: "When change is unclear, review duration and usage; simplify if needed.",
    response_worsened: "Worsening signals suggest pausing newer products or simplifying.",
    response_not_started: "If you have not started, you can reset the start date.",
    response_stopped: "Record why you stopped; simplify or restart later if needed.",
    response_unsure: "When unsure, prefer comparison notes over product changes.",
    urgent_risk: "Warning signs present — prioritize professional review over product changes. Not a diagnosis.",
    stopped_irritation: "If irritation led you to stop, consider simplifying active steps.",
    stopped_complexity: "If complexity led you to stop, consider fewer steps.",
    recent_products_uncertain: "We cannot confidently identify a recent product — please choose.",
    no_routine: "No saved routine is available to adjust.",
  },
  ja: {
    response_improved: "改善の報告があるため、現在のルーティン維持を優先します。",
    response_unchanged: "変化がはっきりしない場合は期間・使い方を確認し、必要なら簡素化を検討します。",
    response_worsened: "悪化のサインがあるため、新しい製品の休止や簡素化を検討します。",
    response_not_started: "まだ始めていない場合は開始日を再設定できます。",
    response_stopped: "中断理由を記録し、必要なら簡素化や開始日再設定を提案します。",
    response_unsure: "確信がない場合は製品変更より比較・メモを優先します。",
    urgent_risk: "危険信号があるため、製品調整より専門家確認を優先します。診断ではありません。",
    stopped_irritation: "刺激で中断した場合は機能性ステップから簡素化を検討します。",
    stopped_complexity: "複雑さで中断した場合はステップ削減を検討します。",
    recent_products_uncertain: "最近追加した製品を特定できないため、ご自身で選んでください。",
    no_routine: "保存されたルーティンがないため調整対象がありません。",
  },
};

const NOTE_LABELS: Record<CheckinLocale, Record<string, string>> = {
  ko: {
    pause_not_delete: "삭제가 아니라 일시 중지입니다. 데이터는 유지됩니다.",
    undo_available: "적용 후 되돌리기가 가능합니다.",
    no_item_change: "이 선택에서는 제품 상태가 바뀌지 않습니다.",
    restart_reschedule_only: "시작일만 다시 잡고, 제품 목록은 삭제하지 않습니다.",
    consultation_blocks_apply: "상담 우선 상태에서는 제품 조정을 적용할 수 없습니다.",
    nothing_to_change: "추가로 일시 중지할 항목이 없습니다.",
    confirm_before_apply: "적용 전에 바뀌는 항목을 확인하세요.",
    after_apply: "변경된 항목은 일시 중지 상태이며, 유지된 항목은 그대로입니다.",
  },
  en: {
    pause_not_delete: "This pauses items — it does not delete them.",
    undo_available: "You can undo after applying.",
    no_item_change: "This choice does not change product status.",
    restart_reschedule_only: "Only the start date is reset; products are kept.",
    consultation_blocks_apply: "Product adjustments are blocked while consultation is prioritized.",
    nothing_to_change: "There is nothing left to pause.",
    confirm_before_apply: "Review what will change before applying.",
    after_apply: "Changed items are paused; kept items stay active.",
  },
  ja: {
    pause_not_delete: "削除ではなく一時停止です。データは残ります。",
    undo_available: "適用後に取り消せます。",
    no_item_change: "この選択では製品状態は変わりません。",
    restart_reschedule_only: "開始日のみ再設定し、製品一覧は削除しません。",
    consultation_blocks_apply: "相談優先の間は製品調整を適用できません。",
    nothing_to_change: "追加で一時停止する項目がありません。",
    confirm_before_apply: "適用前に変更内容を確認してください。",
    after_apply: "変更項目は一時停止、維持項目はそのままです。",
  },
};

export function getRoutineAdjustmentTypeLabel(
  type: RoutineAdjustmentType,
  locale: CheckinLocale = "ko"
): string {
  return TYPE_LABELS[locale][type];
}

export function getRoutineAdjustmentReasonLabel(
  reason: RoutineAdjustmentReason,
  locale: CheckinLocale = "ko"
): string {
  return REASON_LABELS[locale][reason];
}

export function getRoutineAdjustmentNoteLabel(
  key: string,
  locale: CheckinLocale = "ko"
): string {
  return NOTE_LABELS[locale][key] ?? key;
}

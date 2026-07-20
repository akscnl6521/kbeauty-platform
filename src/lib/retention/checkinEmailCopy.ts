/**
 * Check-in care-notification email copy (ko/en/ja).
 * Care channel only ? not marketing copy.
 */

import type {
  CheckinLocale,
  CheckinMilestone,
} from "@/lib/retention/checkinPolicy";

export type CheckinEmailCopyKind = "due" | "reminder";

const MILESTONE_DAY: Record<CheckinMilestone, number> = {
  day3: 3,
  day7: 7,
  day15: 15,
  day30: 30,
};

const SUBJECTS: Record<
  CheckinLocale,
  Record<CheckinEmailCopyKind, Record<CheckinMilestone, string>>
> = {
  ko: {
    due: {
      day3: "3일 체크인 안내 ? 피부 관리 알림",
      day7: "7일 체크인 안내 ? 피부 관리 알림",
      day15: "15일 체크인 안내 ? 피부 관리 알림",
      day30: "30일 체크인 안내 ? 피부 관리 알림",
    },
    reminder: {
      day3: "3일 체크인 재알림 ? 피부 관리 알림",
      day7: "7일 체크인 재알림 ? 피부 관리 알림",
      day15: "15일 체크인 재알림 ? 피부 관리 알림",
      day30: "30일 체크인 재알림 ? 피부 관리 알림",
    },
  },
  en: {
    due: {
      day3: "Day 3 check-in ? care notification",
      day7: "Day 7 check-in ? care notification",
      day15: "Day 15 check-in ? care notification",
      day30: "Day 30 check-in ? care notification",
    },
    reminder: {
      day3: "Day 3 check-in reminder ? care notification",
      day7: "Day 7 check-in reminder ? care notification",
      day15: "Day 15 check-in reminder ? care notification",
      day30: "Day 30 check-in reminder ? care notification",
    },
  },
  ja: {
    due: {
      day3: "3日チェックインのご案内 ? ケア通知",
      day7: "7日チェックインのご案内 ? ケア通知",
      day15: "15日チェックインのご案内 ? ケア通知",
      day30: "30日チェックインのご案内 ? ケア通知",
    },
    reminder: {
      day3: "3日チェックイン再通知 ? ケア通知",
      day7: "7日チェックイン再通知 ? ケア通知",
      day15: "15日チェックイン再通知 ? ケア通知",
      day30: "30日チェックイン再通知 ? ケア通知",
    },
  },
};

const BODIES: Record<
  CheckinLocale,
  Record<CheckinEmailCopyKind, Record<CheckinMilestone, string>>
> = {
  ko: {
    due: {
      day3: "루틴 시작 후 3일 체크인 시점입니다. 짧은 응답으로 상태를 기록해 주세요.",
      day7: "루틴 시작 후 7일 체크인 시점입니다. 짧은 응답으로 상태를 기록해 주세요.",
      day15: "루틴 시작 후 15일 체크인 시점입니다. 짧은 응답으로 상태를 기록해 주세요.",
      day30: "루틴 시작 후 30일 체크인 시점입니다. 짧은 응답으로 상태를 기록해 주세요.",
    },
    reminder: {
      day3: "3일 체크인에 아직 응답이 없습니다. 48시간 재알림입니다. 지금 짧게 기록할 수 있습니다.",
      day7: "7일 체크인에 아직 응답이 없습니다. 48시간 재알림입니다. 지금 짧게 기록할 수 있습니다.",
      day15: "15일 체크인에 아직 응답이 없습니다. 48시간 재알림입니다. 지금 짧게 기록할 수 있습니다.",
      day30: "30일 체크인에 아직 응답이 없습니다. 48시간 재알림입니다. 지금 짧게 기록할 수 있습니다.",
    },
  },
  en: {
    due: {
      day3: "It is time for your day-3 care check-in. Please leave a short update.",
      day7: "It is time for your day-7 care check-in. Please leave a short update.",
      day15: "It is time for your day-15 care check-in. Please leave a short update.",
      day30: "It is time for your day-30 care check-in. Please leave a short update.",
    },
    reminder: {
      day3: "We have not received your day-3 check-in yet. This is your one 48-hour reminder.",
      day7: "We have not received your day-7 check-in yet. This is your one 48-hour reminder.",
      day15: "We have not received your day-15 check-in yet. This is your one 48-hour reminder.",
      day30: "We have not received your day-30 check-in yet. This is your one 48-hour reminder.",
    },
  },
  ja: {
    due: {
      day3: "ルーティン開始から3日のチェックイン時期です。短い回答で状態を記録してください。",
      day7: "ルーティン開始から7日のチェックイン時期です。短い回答で状態を記録してください。",
      day15: "ルーティン開始から15日のチェックイン時期です。短い回答で状態を記録してください。",
      day30: "ルーティン開始から30日のチェックイン時期です。短い回答で状態を記録してください。",
    },
    reminder: {
      day3: "3日チェックインの回答がまだありません。48時間後の再通知です。",
      day7: "7日チェックインの回答がまだありません。48時間後の再通知です。",
      day15: "15日チェックインの回答がまだありません。48時間後の再通知です。",
      day30: "30日チェックインの回答がまだありません。48時間後の再通知です。",
    },
  },
};

const DISCLAIMERS: Record<CheckinLocale, string> = {
  ko: "이 메일은 피부 관리(케어) 알림이며 마케팅·광고 메일이 아닙니다. 알림 설정은 내 설정에서 변경할 수 있습니다.",
  en: "This is a skin-care notification, not a marketing email. You can change notification preferences in Settings.",
  ja: "これはスキンケア通知であり、マーケティングメールではありません。通知設定は設定画面で変更できます。",
};

const PREFERENCE_HINTS: Record<CheckinLocale, string> = {
  ko: "알림을 끄거나 이메일 채널을 변경하려면 설정(/my/settings)을 열어 주세요.",
  en: "To turn off alerts or change the email channel, open Settings (/my/settings).",
  ja: "通知をオフにする、またはメールチャネルを変更するには設定（/my/settings）を開いてください。",
};

export function getCheckinEmailSubject(
  kind: CheckinEmailCopyKind,
  milestone: CheckinMilestone,
  locale: CheckinLocale = "ko"
): string {
  return SUBJECTS[locale][kind][milestone];
}

export function getCheckinEmailBody(
  kind: CheckinEmailCopyKind,
  milestone: CheckinMilestone,
  locale: CheckinLocale = "ko"
): string {
  const day = MILESTONE_DAY[milestone];
  const body = BODIES[locale][kind][milestone];
  return body.includes(String(day)) ? body : `${body} (day ${day})`;
}

export function getCheckinEmailDisclaimer(
  locale: CheckinLocale = "ko"
): string {
  return `${DISCLAIMERS[locale]} ${PREFERENCE_HINTS[locale]}`;
}

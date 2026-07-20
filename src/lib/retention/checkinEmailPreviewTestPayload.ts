/**
 * Preview-only admin check-in email test payload builders.
 * No provider calls, no real user data.
 */

import {
  getCheckinEmailBody,
  getCheckinEmailDisclaimer,
  getCheckinEmailSubject,
  type CheckinEmailCopyKind,
} from "@/lib/retention/checkinEmailCopy";
import { buildCheckinEmailSendRequest } from "@/lib/retention/buildCheckinEmailPayload";
import type {
  CheckinEmailKind,
  CheckinEmailQueueItem,
} from "@/lib/retention/checkinEmailQueuePolicy";
import type {
  CheckinLocale,
  CheckinMilestone,
} from "@/lib/retention/checkinPolicy";
import type { EmailSendRequest } from "@/lib/email/provider/types";

export const PREVIEW_EMAIL_TEST_CHECKIN_ID = "preview-email-test";

export type PreviewTestEmailKind = Extract<
  CheckinEmailKind,
  "checkin_due" | "checkin_reminder"
>;

const PREVIEW_SUBJECT_PREFIX = "[Preview Test] ";

function copyKindFromQueue(kind: PreviewTestEmailKind): CheckinEmailCopyKind {
  if (kind === "checkin_due") return "due";
  if (kind === "checkin_reminder") return "reminder";
  return "due";
}

export function buildPreviewTestEmailBanner(locale: CheckinLocale): string {
  const lines: Record<CheckinLocale, string[]> = {
    ko: [
      "K-Beauty Match Preview 테스트 이메일",
      "실제 사용자 체크인 데이터가 아닙니다.",
      "피부 관리 알림 테스트입니다.",
      "마케팅 이메일이 아닙니다.",
    ],
    en: [
      "K-Beauty Match Preview test email",
      "This is not real user check-in data.",
      "Care notification test only.",
      "Not a marketing email.",
    ],
    ja: [
      "K-Beauty Match Preview テストメール",
      "実際のユーザーチェックインデータではありません。",
      "ケア通知のテストです。",
      "マーケティングメールではありません。",
    ],
  };
  return lines[locale].join("\n");
}

export function buildPreviewTestCheckinEmailQueueItem(input: {
  milestone: CheckinMilestone;
  kind: PreviewTestEmailKind;
  locale: CheckinLocale;
  recipientMask: string;
  idempotencyKey: string;
  now?: Date;
}): CheckinEmailQueueItem {
  const now = input.now ?? new Date();
  const ts = now.toISOString();

  return {
    id: `preview-test-${input.milestone}-${input.kind}`,
    subjectId: "preview-admin-test",
    checkInId: PREVIEW_EMAIL_TEST_CHECKIN_ID,
    milestone: input.milestone,
    kind: input.kind,
    recipientMask: input.recipientMask,
    locale: input.locale,
    timezone: "UTC",
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: ts,
    lastErrorCode: null,
    idempotencyKey: input.idempotencyKey,
    payload: {
      subjectKey: `email.${input.kind}.${input.milestone}.subject`,
      bodyKey: `email.${input.kind}.${input.milestone}.body`,
      locale: input.locale,
      milestone: input.milestone,
      kind: input.kind,
      checkinUrlPath: `/my/check-ins/${PREVIEW_EMAIL_TEST_CHECKIN_ID}`,
      preferenceUrlPath: "/my/settings",
      scheduledAt: ts,
    },
    createdAt: ts,
    updatedAt: ts,
    scheduledAt: ts,
    sentAt: null,
    cancelledAt: null,
  };
}

export function buildPreviewTestEmailPreview(input: {
  milestone: CheckinMilestone;
  kind: PreviewTestEmailKind;
  locale: CheckinLocale;
}): { subject: string; textBody: string } {
  const copyKind = copyKindFromQueue(input.kind);
  const banner = buildPreviewTestEmailBanner(input.locale);
  const subject = getCheckinEmailSubject(copyKind, input.milestone, input.locale);
  const bodyCore = getCheckinEmailBody(copyKind, input.milestone, input.locale);
  const disclaimer = getCheckinEmailDisclaimer(input.locale);
  const textBody = [banner, "", bodyCore, "", disclaimer].join("\n");
  return { subject, textBody };
}

export function buildPreviewTestEmailSendRequest(input: {
  item: CheckinEmailQueueItem;
  recipientEmail: string;
}):
  | { ok: true; request: EmailSendRequest }
  | { ok: false; errorCode: string } {
  const built = buildCheckinEmailSendRequest({
    item: input.item,
    recipientEmail: input.recipientEmail,
  });
  if (!built.ok) {
    return { ok: false, errorCode: built.errorCode };
  }

  const banner = buildPreviewTestEmailBanner(input.item.locale);
  return {
    ok: true,
    request: {
      ...built.request,
      subject: `${PREVIEW_SUBJECT_PREFIX}${built.request.subject}`,
      textBody: `${banner}\n\n${built.request.textBody}`,
    },
  };
}

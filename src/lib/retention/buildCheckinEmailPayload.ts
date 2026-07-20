/**
 * Build provider-neutral EmailSendRequest from a check-in queue item.
 * Text body only. No HTML, photos, health details, or affiliate links.
 */

import {
  getCheckinEmailBody,
  getCheckinEmailDisclaimer,
  getCheckinEmailSubject,
  type CheckinEmailCopyKind,
} from "@/lib/retention/checkinEmailCopy";
import {
  isValidCheckinEmailAddress,
  type CheckinEmailQueueItem,
} from "@/lib/retention/checkinEmailQueuePolicy";
import type {
  EmailProviderErrorCode,
  EmailSendRequest,
} from "@/lib/email/provider/types";

const CHECKIN_PATH_RE = /^\/my\/check-ins\/[A-Za-z0-9_-]+$/;
const PREFERENCE_PATH_RE = /^\/my\/settings(?:\?[A-Za-z0-9_=&%-]*)?$/;
const UNSAFE_RE =
  /photo|acute|diagnos|affiliate|sponsored|javascript:|data:|https?:\/\//i;

export function isSafeCheckinUrlPath(path: string): boolean {
  if (typeof path !== "string") return false;
  const p = path.trim();
  if (!p || p.includes("\\") || p.includes("//")) return false;
  if (/^(javascript|data|https?):/i.test(p)) return false;
  return CHECKIN_PATH_RE.test(p);
}

export function isSafePreferenceUrlPath(path: string): boolean {
  if (typeof path !== "string") return false;
  const p = path.trim();
  if (!p || p.includes("\\") || p.includes("//")) return false;
  if (/^(javascript|data|https?):/i.test(p)) return false;
  return PREFERENCE_PATH_RE.test(p);
}

function copyKindFromQueue(
  kind: CheckinEmailQueueItem["kind"]
): CheckinEmailCopyKind | null {
  if (kind === "checkin_due") return "due";
  if (kind === "checkin_reminder") return "reminder";
  return null;
}

export function buildCheckinEmailSendRequest(input: {
  item: CheckinEmailQueueItem;
  recipientEmail: string;
}):
  | { ok: true; request: EmailSendRequest }
  | { ok: false; errorCode: EmailProviderErrorCode } {
  const { item, recipientEmail } = input;

  if (!isValidCheckinEmailAddress(recipientEmail)) {
    return { ok: false, errorCode: "invalid_recipient" };
  }

  const copyKind = copyKindFromQueue(item.kind);
  if (!copyKind) {
    return { ok: false, errorCode: "invalid_request" };
  }

  const checkinUrlPath = item.payload.checkinUrlPath?.trim() ?? "";
  const preferenceUrlPath = item.payload.preferenceUrlPath?.trim() ?? "";
  if (!isSafeCheckinUrlPath(checkinUrlPath)) {
    return { ok: false, errorCode: "unsafe_payload" };
  }
  if (!isSafePreferenceUrlPath(preferenceUrlPath)) {
    return { ok: false, errorCode: "unsafe_payload" };
  }

  const locale = item.locale ?? item.payload.locale ?? "ko";
  const milestone = item.milestone;
  const subject = getCheckinEmailSubject(copyKind, milestone, locale);
  const bodyCore = getCheckinEmailBody(copyKind, milestone, locale);
  const disclaimer = getCheckinEmailDisclaimer(locale);
  const textBody = [
    bodyCore,
    `Check-in: ${checkinUrlPath}`,
    disclaimer,
  ].join("\n\n");

  if (UNSAFE_RE.test(subject) || UNSAFE_RE.test(textBody)) {
    return { ok: false, errorCode: "unsafe_payload" };
  }

  return {
    ok: true,
    request: {
      to: recipientEmail.trim(),
      subject,
      textBody,
      locale,
      idempotencyKey: item.idempotencyKey,
      metadata: {
        kind: item.kind,
        milestone,
        checkInId: item.checkInId,
        checkinUrlPath,
        preferenceUrlPath,
      },
    },
  };
}

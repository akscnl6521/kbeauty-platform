/**
 * Email notification adapter — dry-run by default.
 * Never sends when provider/credentials missing. Never auto-diagnoses.
 */

export type CareEmailTemplateId =
  | "checkin_day_3"
  | "checkin_day_7"
  | "checkin_day_15"
  | "checkin_day_30";

export type CareEmailPayload = {
  to: string;
  templateId: CareEmailTemplateId;
  checkInId: string;
  day: 3 | 7 | 15 | 30;
  timezone: string;
  deepLinkPath: string;
  emailOptIn: boolean;
};

export type CareEmailSendResult = {
  status: "sent" | "dry_run" | "skipped" | "failed";
  reason: string;
  provider: string | null;
  previewSubject?: string;
  previewBody?: string;
};

export function buildCheckinEmailPreview(payload: CareEmailPayload): {
  subject: string;
  body: string;
} {
  const subject = `Day ${payload.day} 체크인 안내 — K-Beauty Match`;
  const body = [
    `안녕하세요.`,
    ``,
    `Day ${payload.day} 체크인 시기가 되었습니다.`,
    `짧은 질문으로 피부 상태를 기록해 주세요. 의료 진단이 아닙니다.`,
    ``,
    `체크인: ${payload.deepLinkPath}`,
    `타임존: ${payload.timezone}`,
    ``,
    `이메일 수신을 원하지 않으면 설정에서 끌 수 있습니다.`,
  ].join("\n");
  return { subject, body };
}

export function getEmailProviderName(): string | null {
  const name = (process.env.CARE_EMAIL_PROVIDER || "").trim().toLowerCase();
  if (!name || name === "none" || name === "dry-run") return null;
  return name;
}

export function hasEmailCredentials(): boolean {
  const provider = getEmailProviderName();
  if (!provider) return false;
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY);
  if (provider === "smtp") {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  }
  return false;
}

/**
 * Idempotent send gate. Real network send is never performed without credentials.
 */
export async function sendCareEmail(
  payload: CareEmailPayload,
  options?: { dryRun?: boolean; alreadySentFingerprint?: boolean }
): Promise<CareEmailSendResult> {
  const preview = buildCheckinEmailPreview(payload);

  if (!payload.emailOptIn) {
    return {
      status: "skipped",
      reason: "email_opt_out",
      provider: getEmailProviderName(),
      ...previewSubjectBody(preview),
    };
  }

  if (options?.alreadySentFingerprint) {
    return {
      status: "skipped",
      reason: "duplicate_send_prevented",
      provider: getEmailProviderName(),
      ...previewSubjectBody(preview),
    };
  }

  const dryRun = options?.dryRun !== false || !hasEmailCredentials();
  const provider = getEmailProviderName();

  if (!provider || !hasEmailCredentials() || dryRun) {
    return {
      status: "dry_run",
      reason: !provider
        ? "provider_missing"
        : !hasEmailCredentials()
          ? "credentials_missing"
          : "dry_run_forced",
      provider,
      ...previewSubjectBody(preview),
    };
  }

  // Live send path reserved for Phase E with approved provider — still blocked here.
  return {
    status: "skipped",
    reason: "live_send_disabled_until_phase_e_approval",
    provider,
    ...previewSubjectBody(preview),
  };
}

function previewSubjectBody(preview: { subject: string; body: string }) {
  return {
    previewSubject: preview.subject,
    previewBody: preview.body,
  };
}

/**
 * Structured audit log for Preview admin check-in email test sends.
 * Console only - no DB, no secrets.
 */

export function logPreviewTestEmailSend(input: {
  timestamp: string;
  recipientMask: string;
  milestone: string;
  locale: string;
  kind: string;
  resultCode: string;
  messageIdPrefix?: string;
}): void {
  const entry: Record<string, string> = {
    event: "preview_checkin_email_test_send",
    timestamp: input.timestamp,
    recipientMask: input.recipientMask,
    milestone: input.milestone,
    locale: input.locale,
    kind: input.kind,
    resultCode: input.resultCode,
  };
  if (input.messageIdPrefix) {
    entry.messageIdPrefix = input.messageIdPrefix;
  }
  console.info(JSON.stringify(entry));
}

/**
 * Provider-neutral email types. No SDK, no network.
 */

export type EmailDeliveryMode = "disabled" | "dry_run" | "live";

export type EmailProviderName = "none" | "dry_run" | "resend" | "sendgrid" | "ses";

export type EmailProviderErrorCode =
  | "provider_disabled"
  | "live_mode_blocked"
  | "invalid_request"
  | "invalid_recipient"
  | "unsafe_payload"
  | "duplicate_request"
  | "temporary_provider_error"
  | "permanent_provider_error";

export type EmailSendRequest = {
  to: string;
  subject: string;
  textBody: string;
  locale: string;
  idempotencyKey: string;
  metadata: {
    kind: string;
    milestone: string;
    checkInId: string;
    checkinUrlPath: string;
    preferenceUrlPath: string;
  };
};

export type EmailSendResult =
  | {
      ok: true;
      mode: EmailDeliveryMode;
      providerMessageId: string;
      idempotencyKey: string;
      recipientMask: string;
    }
  | {
      ok: false;
      mode: EmailDeliveryMode;
      errorCode: EmailProviderErrorCode;
      retryable: boolean;
      recipientMask: string | null;
      detail?: string;
    };

export type EmailProvider = {
  readonly name: string;
  readonly mode: EmailDeliveryMode;
  send(request: EmailSendRequest): Promise<EmailSendResult>;
};

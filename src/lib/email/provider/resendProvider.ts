/**
 * Live Resend email provider — validates and sends via injected transport.
 * No console dump of full recipient or body. Tests must inject transport.
 */

import {
  isValidCheckinEmailAddress,
  maskEmailAddress,
} from "@/lib/retention/checkinEmailQueuePolicy";
import { normalizeResendError } from "./normalizeResendError";
import { hasUnsafeCareEmailContent } from "./validateCareEmailBodyUrls";
import type {
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
} from "./types";

export type ResendSendInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  metadata?: Record<string, string>;
};

export type ResendSendResult = {
  data?: { id?: string | null } | null;
  error?: unknown;
};

export type ResendTransport = {
  send(input: ResendSendInput): Promise<ResendSendResult>;
};

export type ResendIdempotencyRegistry = {
  has(key: string): boolean;
  set(key: string, messageId: string): void;
};

function buildInternalMetadata(request: EmailSendRequest): Record<string, string> {
  return {
    kind: request.metadata.kind,
    milestone: request.metadata.milestone,
    checkInId: request.metadata.checkInId,
    idempotencyKey: request.idempotencyKey,
  };
}

async function createDefaultTransport(apiKey: string): Promise<ResendTransport> {
  const { Resend } = await import("resend");
  const client = new Resend(apiKey);
  return {
    async send(input: ResendSendInput): Promise<ResendSendResult> {
      return client.emails.send({
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }) as Promise<ResendSendResult>;
    },
  };
}

export function createResendEmailProvider(options: {
  apiKey: string;
  fromAddress: string;
  transport?: ResendTransport;
  registry?: ResendIdempotencyRegistry;
}): EmailProvider {
  const fromAddress = options.fromAddress.trim();
  let transportPromise: Promise<ResendTransport> | null = options.transport
    ? Promise.resolve(options.transport)
    : null;

  const getTransport = (): Promise<ResendTransport> => {
    if (!transportPromise) {
      transportPromise = createDefaultTransport(options.apiKey);
    }
    return transportPromise;
  };

  return {
    name: "resend",
    mode: "live",
    async send(request: EmailSendRequest): Promise<EmailSendResult> {
      const mask = isValidCheckinEmailAddress(request.to)
        ? maskEmailAddress(request.to)
        : null;

      if (!isValidCheckinEmailAddress(request.to)) {
        return {
          ok: false,
          mode: "live",
          errorCode: "invalid_recipient",
          retryable: false,
          recipientMask: mask,
        };
      }
      if (
        !request.subject?.trim() ||
        !request.textBody?.trim() ||
        !request.idempotencyKey?.trim()
      ) {
        return {
          ok: false,
          mode: "live",
          errorCode: "invalid_request",
          retryable: false,
          recipientMask: mask,
        };
      }
      if (hasUnsafeCareEmailContent(request)) {
        return {
          ok: false,
          mode: "live",
          errorCode: "unsafe_payload",
          retryable: false,
          recipientMask: mask,
        };
      }
      if (options.registry?.has(request.idempotencyKey)) {
        return {
          ok: false,
          mode: "live",
          errorCode: "duplicate_request",
          retryable: false,
          recipientMask: mask,
          detail: "already_processed",
        };
      }

      const transport = await getTransport();
      const response = await transport.send({
        from: fromAddress,
        to: request.to.trim(),
        subject: request.subject.trim(),
        text: request.textBody.trim(),
        metadata: buildInternalMetadata(request),
      });

      if (response.error) {
        const normalized = normalizeResendError(response.error);
        return {
          ok: false,
          mode: "live",
          errorCode: normalized.errorCode,
          retryable: normalized.retryable,
          recipientMask: mask,
          detail: normalized.detail,
        };
      }

      const messageId = response.data?.id?.trim();
      if (!messageId) {
        return {
          ok: false,
          mode: "live",
          errorCode: "temporary_provider_error",
          retryable: true,
          recipientMask: mask,
          detail: "missing_provider_message_id",
        };
      }

      options.registry?.set(request.idempotencyKey, messageId);
      return {
        ok: true,
        mode: "live",
        providerMessageId: messageId,
        idempotencyKey: request.idempotencyKey,
        recipientMask: mask!,
      };
    },
  };
}

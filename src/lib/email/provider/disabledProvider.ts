/**
 * Explicitly refuses all sends. Not retryable.
 */

import { maskEmailAddress } from "@/lib/retention/checkinEmailQueuePolicy";
import type { EmailProvider, EmailSendRequest, EmailSendResult } from "./types";

export function createDisabledEmailProvider(): EmailProvider {
  return {
    name: "disabled",
    mode: "disabled",
    async send(request: EmailSendRequest): Promise<EmailSendResult> {
      return {
        ok: false,
        mode: "disabled",
        errorCode: "provider_disabled",
        retryable: false,
        recipientMask: maskEmailAddress(request.to),
      };
    },
  };
}

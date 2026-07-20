import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { maskFromAddressForDisplay } from "@/lib/admin/maskEmailFromAddress";
import {
  evaluatePreviewTestSendGatesForDisplay,
  isVercelPreviewEnvironment,
  selectFirstAllowlistRecipient,
} from "@/lib/admin/checkinEmailTestSendPolicy";
import {
  resolveEmailDeliveryMode,
  resolveEmailProviderName,
} from "@/lib/email/provider/getEmailProvider";
import { validateEmailFromAddress } from "@/lib/email/provider/emailFromAddress";
import { parseRecipientAllowlist } from "@/lib/email/provider/recipientAllowlist";
import { maskEmailAddress } from "@/lib/retention/checkinEmailQueuePolicy";
import { buildPreviewTestEmailPreview } from "@/lib/retention/checkinEmailPreviewTestPayload";
import { AdminSubnav } from "../../AdminSubnav";
import { CheckInEmailTestClient } from "./CheckInEmailTestClient";

export const dynamic = "force-dynamic";

function readDisplayEnv(): Record<string, string | undefined> {
  return {
    VERCEL_ENV: process.env.VERCEL_ENV,
    APP_ENV: process.env.APP_ENV,
    EMAIL_DELIVERY_MODE: process.env.EMAIL_DELIVERY_MODE,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
    EMAIL_STAGING_RECIPIENT_ALLOWLIST:
      process.env.EMAIL_STAGING_RECIPIENT_ALLOWLIST,
    EMAIL_LIVE_KILL_SWITCH: process.env.EMAIL_LIVE_KILL_SWITCH,
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "[set]" : undefined,
  };
}

export default async function AdminCheckInEmailTestPage() {
  await requireAdminUser();

  const env = readDisplayEnv();
  const gates = evaluatePreviewTestSendGatesForDisplay(env);
  const deliveryMode = resolveEmailDeliveryMode(env);
  const providerName = resolveEmailProviderName(env);

  const fromResult = validateEmailFromAddress(process.env.EMAIL_FROM_ADDRESS);
  const fromMasked = fromResult.ok
    ? maskFromAddressForDisplay(fromResult.value)
    : "***@[not-configured]";

  const allowlist = parseRecipientAllowlist(
    process.env.EMAIL_STAGING_RECIPIENT_ALLOWLIST
  );
  const firstRecipient = selectFirstAllowlistRecipient(allowlist);
  const recipientMasked = firstRecipient
    ? maskEmailAddress(firstRecipient)
    : "[allowlist-empty]";

  const initialPreview = buildPreviewTestEmailPreview({
    milestone: "day7",
    kind: "checkin_due",
    locale: "ko",
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">체크인 이메일 테스트 발송</h1>
      <AdminSubnav current="care" />
      <div className="mt-6">
        <CheckInEmailTestClient
          deliveryMode={deliveryMode}
          providerName={providerName}
          fromMasked={fromMasked}
          recipientMasked={recipientMasked}
          previewOnly={isVercelPreviewEnvironment(env)}
          sendEnabled={gates.sendEnabled}
          productionBlocked={gates.productionBlocked}
          initialMilestone="day7"
          initialLocale="ko"
          initialKind="checkin_due"
          initialPreview={initialPreview}
        />
      </div>
      <Link href="/admin/care" className="mt-6 inline-block text-[#8B6914] underline">
        ← Care
      </Link>
    </main>
  );
}

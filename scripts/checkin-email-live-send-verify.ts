/**
 * Real end-to-end live send verification for the 3/7/15/30-day check-in
 * milestones. Sends one real email per milestone via Resend to the
 * user's own allowlisted address only. Never touches Production (the
 * live gate itself hard-blocks a production email environment).
 *
 * Run via: npx tsx scripts/checkin-email-live-send-verify.ts
 */
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
loadDotEnvLocal();

async function main() {
  const { processCheckinEmailLive } = await import(
    "../src/lib/retention/processCheckinEmailLive"
  );
  const { evaluateEmailLiveProviderGate } = await import(
    "../src/lib/email/provider/emailLiveGate"
  );
  const recipientEmail = process.env.EMAIL_STAGING_RECIPIENT_ALLOWLIST!.split(",")[0]!.trim();

  const gate = evaluateEmailLiveProviderGate(process.env as Record<string, string | undefined>);
  console.log("live gate:", JSON.stringify(gate));
  if (!gate.ok) {
    console.error("Live gate blocked — aborting, not attempting any send.");
    process.exitCode = 1;
    return;
  }

  const milestones = ["day3", "day7", "day15", "day30"] as const;
  const results: Array<Record<string, unknown>> = [];

  for (const milestone of milestones) {
    const now = new Date().toISOString();
    const checkInId = `e2e-${milestone}-${Date.now()}`;
    const item = {
      id: `q-${checkInId}`,
      subjectId: "e2e-test-subject",
      checkInId,
      milestone,
      kind: "checkin_due" as const,
      recipientMask: "a***@gmail.com",
      locale: "ko" as const,
      timezone: "Asia/Seoul",
      status: "pending" as const,
      attemptCount: 0,
      nextAttemptAt: now,
      lastErrorCode: null,
      idempotencyKey: `checkin-email:e2e:${checkInId}:${milestone}:checkin_due:${now}`,
      payload: {
        subjectKey: `email.checkin_due.${milestone}.subject`,
        bodyKey: `email.checkin_due.${milestone}.body`,
        locale: "ko" as const,
        milestone,
        kind: "checkin_due" as const,
        checkinUrlPath: `/my/check-ins/${checkInId}`,
        preferenceUrlPath: "/my/settings",
        scheduledAt: now,
      },
      createdAt: now,
      updatedAt: now,
      scheduledAt: now,
      sentAt: null,
      cancelledAt: null,
    };

    const result = await processCheckinEmailLive({
      item,
      recipientEmail,
      careCheckinConsent: true,
      careEmailChannelConsent: true,
      env: process.env as Record<string, string | undefined>,
    });

    results.push({
      milestone,
      outcome: result.outcome,
      reasonCode: result.reasonCode,
      providerMessageId:
        result.providerResult && result.providerResult.ok
          ? result.providerResult.providerMessageId
          : null,
      providerError:
        result.providerResult && !result.providerResult.ok
          ? result.providerResult.errorCode
          : null,
    });

    // Space sends out slightly to be a considerate real-provider citizen.
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(JSON.stringify({ recipientEmail, results }, null, 2));
}

main().catch((err) => {
  console.error("[checkin-email-live-send-verify] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

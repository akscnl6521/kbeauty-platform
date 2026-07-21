import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";
import {
  assertCareWorkerAdminEnvironmentAllowed,
  careWorkerAdminRateLimiter,
  parseCareWorkerAdminActionBody,
} from "@/lib/admin/checkinEmailWorkerAdminPolicy";
import {
  getCheckinEmailWorkerAdminSnapshot,
  manualCancelJob,
  manualRetryJob,
  runDryRunTick,
} from "@/lib/admin/checkinEmailWorkerAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readEnv(): Record<string, string | undefined> {
  return {
    VERCEL_ENV: process.env.VERCEL_ENV,
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
  };
}

function envBlockedResponse() {
  const gate = assertCareWorkerAdminEnvironmentAllowed(readEnv());
  if (gate.ok) return null;
  return jsonFail(
    gate.httpStatus,
    gate.code,
    "Care worker admin is not available in this environment."
  );
}

/** Snapshot: queue stats, failures, stale, recent jobs/audit — no PII. */
export const GET = withAdminAuth(async () => {
  try {
    const blocked = envBlockedResponse();
    if (blocked) return blocked;
    const data = await getCheckinEmailWorkerAdminSnapshot({ env: readEnv() });
    return jsonOk(data);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

/**
 * Actions: dry_run_tick | manual_retry | manual_cancel.
 * Live email provider is never invoked.
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const blocked = envBlockedResponse();
    if (blocked) return blocked;

    const rate = careWorkerAdminRateLimiter.check(session.userId);
    if (!rate.ok) {
      return jsonFail(429, rate.code, "Too many admin worker actions. Try again later.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonFail(400, "invalid_body", "JSON body required.");
    }

    const parsed = parseCareWorkerAdminActionBody(body);
    if (!parsed.ok) {
      return jsonFail(400, parsed.code, "Invalid worker admin action.");
    }

    careWorkerAdminRateLimiter.record(session.userId);
    const value = parsed.value;

    if (value.action === "dry_run_tick") {
      const result = await runDryRunTick({
        adminId: session.userId,
        limit: value.limit,
        staleSeconds: value.staleSeconds,
        env: readEnv(),
      });
      return jsonOk({ action: value.action, result });
    }

    if (value.action === "manual_retry") {
      const result = await manualRetryJob({
        jobId: value.jobId!,
        confirm: value.confirm,
        adminId: session.userId,
        allowCancelled: value.allowCancelledRetry,
        env: readEnv(),
      });
      return jsonOk({ action: value.action, result });
    }

    const result = await manualCancelJob({
      jobId: value.jobId!,
      confirm: value.confirm,
      adminId: session.userId,
      env: readEnv(),
    });
    return jsonOk({ action: value.action, result });
  } catch (error) {
    const e = error as { code?: string; httpStatus?: number; message?: string };
    if (e?.code && e?.httpStatus) {
      return jsonFail(e.httpStatus, e.code, e.message || e.code);
    }
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

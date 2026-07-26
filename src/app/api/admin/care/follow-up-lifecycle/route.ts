import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { getFollowUpLifecycleAdminSummaryFromMemory } from "@/lib/admin/followUpLifecycleAdmin";

export const dynamic = "force-dynamic";

/**
 * Admin follow-up lifecycle visibility.
 * In-memory/fixture counts only — no PII, no real delivery claims.
 */
export async function GET() {
  await requireAdminUser();
  const summary = getFollowUpLifecycleAdminSummaryFromMemory();
  return NextResponse.json({
    ok: true,
    data: summary,
  });
}

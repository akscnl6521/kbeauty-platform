import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { summarizeCommerceAnalytics } from "@/lib/commercial/commerceAnalytics";
import {
  buildAffiliateAdminSummary,
  listAffiliateLinks,
} from "@/lib/commercial/commerceStore";

export const dynamic = "force-dynamic";

/**
 * Admin commerce visibility — affiliate/sponsored review counts + analytics summary.
 * In-memory only · no PII · no Production write.
 */
export async function GET() {
  await requireAdminUser();
  return NextResponse.json({
    ok: true,
    data: {
      affiliate: buildAffiliateAdminSummary(),
      links: listAffiliateLinks().slice(0, 50),
      analytics: summarizeCommerceAnalytics(),
      productionTouched: false,
      databaseTouched: false,
    },
  });
}

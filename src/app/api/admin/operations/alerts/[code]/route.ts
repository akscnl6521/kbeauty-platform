import { NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations/health";
import { getAlertDetail } from "@/lib/admin/operations/alerts";
import type { OperationsAlertCode } from "@/lib/admin/operations/types";
import { listAlertRules } from "@/lib/admin/operations/rules";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

const KNOWN = new Set(listAlertRules().map((r) => r.code));

/**
 * GET /api/admin/operations/alerts/[code]
 */
export const GET = withAdminAuth(
  async (_request: NextRequest, context: RouteContext) => {
    try {
      const params = (await context.params) ?? {};
      const raw = params.code;
      const code = Array.isArray(raw) ? raw[0] : raw;
      if (!code || !KNOWN.has(code as OperationsAlertCode)) {
        return jsonOk({ found: false, code: code ?? null });
      }
      const snapshot = await getOperationsHealthSnapshot({
        persistAlerts: false,
      });
      const detail = getAlertDetail(
        code as OperationsAlertCode,
        snapshot.alerts
      );
      return jsonOk({
        found: Boolean(detail.alert),
        code,
        ...detail,
        metricsSummary: {
          recommendationEligible: snapshot.metrics.recommendation.eligibleKr,
          verifiedOffers: snapshot.metrics.quality.verifiedOffers,
          reviewPending: snapshot.metrics.review.pending,
          lastBatchAt: snapshot.metrics.worker.lastBatchAt,
        },
      });
    } catch (error) {
      return jsonFromCaughtError(error);
    }
  },
  ADMIN_ROLES
);

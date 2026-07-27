import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";
import {
  getUsageGuideQueue,
  parseUsageGuideListParams,
} from "@/lib/admin/usageGuideReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/usage-guides — §36.5 usage guidance review queue. Read-only. */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const parsed = parseUsageGuideListParams(request.nextUrl.searchParams);
    const result = await getUsageGuideQueue({
      page: String(parsed.page),
      status: parsed.status,
      locale: parsed.locale,
    });

    if (!result.schemaReady) {
      return jsonOk({
        schemaReady: false,
        migrationPath: result.migrationPath,
        items: [],
      });
    }

    return jsonOk({
      schemaReady: true,
      items: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      filters: result.filters,
      counts: result.counts,
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

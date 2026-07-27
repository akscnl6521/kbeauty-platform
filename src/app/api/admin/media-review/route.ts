import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";
import {
  getMediaReviewQueue,
  parseMediaReviewListParams,
} from "@/lib/admin/mediaReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/media-review — usage-video review queue.
 * Read-only. Any admin role may look.
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const parsed = parseMediaReviewListParams(request.nextUrl.searchParams);
    const result = await getMediaReviewQueue({
      page: String(parsed.page),
      status: parsed.status,
      scope: parsed.scope,
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

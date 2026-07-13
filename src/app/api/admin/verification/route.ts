import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import {
  getAdminVerificationQueue,
  parseAdminVerificationListParams,
} from "@/lib/admin/verification";
import { createVerificationQueueItem } from "@/lib/admin/verification-write";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/verification — list
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const params = parseAdminVerificationListParams(
      request.nextUrl.searchParams
    );
    const result = await getAdminVerificationQueue(params);

    return jsonOk({
      items: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      filters: result.filters,
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

/**
 * POST /api/admin/verification — create queue item
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
    }

    const payload = (body ?? {}) as Record<string, unknown>;
    const created = await createVerificationQueueItem(session, {
      entityType: payload.entityType ?? payload.entity_type,
      entityId: payload.entityId ?? payload.entity_id,
      reviewType: payload.reviewType ?? payload.review_type,
      priority: payload.priority,
      reason: payload.reason,
    });

    return jsonOk(created, 201);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

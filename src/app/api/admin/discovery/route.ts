import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import {
  getAdminDiscoveryCandidates,
  parseAdminDiscoveryListParams,
} from "@/lib/admin/discovery";
import { createDiscoveryCandidate } from "@/lib/admin/discovery-write";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only admin discovery candidate list.
 * Allowed: all admin roles. SELECT only.
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const params = parseAdminDiscoveryListParams(request.nextUrl.searchParams);
    const result = await getAdminDiscoveryCandidates(params);

    return NextResponse.json({
      ok: true,
      data: {
        items: result.items,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
        filters: result.filters,
      },
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

/**
 * Create discovery candidate (write).
 * POST /api/admin/discovery
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
    const created = await createDiscoveryCandidate(session, {
      discoveredName: payload.discoveredName ?? payload.discovered_name,
      discoveredBrand: payload.discoveredBrand ?? payload.discovered_brand,
      discoveredUrl: payload.discoveredUrl ?? payload.discovered_url,
      discoveredCountry:
        payload.discoveredCountry ?? payload.discovered_country,
      sourceType: payload.sourceType ?? payload.source_type,
      notes: payload.notes,
    });

    return jsonOk(created, 201);
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);

import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import {
  getAdminDiscoveryDetail,
  parseAdminDiscoveryId,
} from "@/lib/admin/discovery-detail";
import { updateDiscoveryCandidate } from "@/lib/admin/discovery-write";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

async function readId(context: RouteContext): Promise<string | null> {
  const params = (await context.params) ?? {};
  const rawId = params.id;
  return Array.isArray(rawId) ? rawId[0] ?? null : rawId ?? null;
}

/**
 * GET /api/admin/discovery/[id] — read-only detail
 */
export const GET = withAdminAuth(
  async (_request: NextRequest, context: RouteContext) => {
    try {
      const candidateId = parseAdminDiscoveryId(await readId(context));
      if (!candidateId) {
        return jsonFail(400, "INVALID_INPUT", "Invalid discovery candidate id.");
      }

      const data = await getAdminDiscoveryDetail(candidateId);
      if (!data) {
        return jsonFail(404, "NOT_FOUND", "Discovery candidate not found.");
      }

      return jsonOk(data);
    } catch (error) {
      return jsonFromCaughtError(error);
    }
  },
  ADMIN_ROLES
);

/**
 * PATCH /api/admin/discovery/[id] — limited updates + product link
 */
export const PATCH = withAdminAuth(
  async (request: NextRequest, context: RouteContext, session) => {
    try {
      const idValue = await readId(context);
      if (!idValue) {
        return jsonFail(400, "INVALID_INPUT", "Invalid discovery candidate id.");
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
      }

      const payload = (body ?? {}) as Record<string, unknown>;
      const updated = await updateDiscoveryCandidate(session, idValue, {
        discoveredName: payload.discoveredName ?? payload.discovered_name,
        discoveredBrand: payload.discoveredBrand ?? payload.discovered_brand,
        discoveredUrl: payload.discoveredUrl ?? payload.discovered_url,
        discoveredCountry:
          payload.discoveredCountry ?? payload.discovered_country,
        sourceType: payload.sourceType ?? payload.source_type,
        notes: payload.notes,
        linkedProductId:
          payload.linkedProductId ?? payload.linked_product_id,
        duplicateCheckStatus:
          payload.duplicateCheckStatus ?? payload.duplicate_check_status,
      });

      return jsonOk(updated);
    } catch (error) {
      return jsonFromCaughtError(error);
    }
  },
  ADMIN_ROLES
);

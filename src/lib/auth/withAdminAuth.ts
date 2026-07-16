import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import {
  requireAdminRole,
  requireAdminUser,
  type AdminSession,
} from "@/lib/auth/admin";
import { isAdminAuthError } from "@/lib/auth/errors";
import type { AdminRole } from "@/lib/auth/roles";

type AdminRouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

type AdminRouteHandler = (
  request: NextRequest,
  context: AdminRouteContext,
  session: AdminSession
) => Promise<Response> | Response;

function jsonError(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
    },
    { status }
  );
}

/**
 * Wraps a Route Handler with admin session + optional role allow-list.
 */
export function withAdminAuth(
  handler: AdminRouteHandler,
  allowedRoles?: readonly AdminRole[]
) {
  return async (request: NextRequest, context: AdminRouteContext = {}) => {
    try {
      const session = allowedRoles?.length
        ? await requireAdminRole(allowedRoles)
        : await requireAdminUser();

      return await handler(request, context, session);
    } catch (error) {
      if (isAdminAuthError(error)) {
        return jsonError(error.httpStatus, error.code, error.message);
      }

      return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
    }
  };
}

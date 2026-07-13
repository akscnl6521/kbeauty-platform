import "server-only";

import { NextResponse } from "next/server";
import { isAdminAuthError } from "@/lib/auth/errors";
import { isAdminWriteError } from "@/lib/admin/write-errors";

export function jsonOk<T>(
  data: T,
  status = 200
): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonFail(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: details ? { code, message, details } : { code, message },
    },
    { status }
  );
}

/**
 * Maps auth/write errors to standard API responses. Never leaks DB internals.
 */
export function jsonFromCaughtError(error: unknown): NextResponse {
  if (isAdminAuthError(error)) {
    const message =
      error.code === "FORBIDDEN"
        ? "이 작업을 수행할 권한이 없습니다."
        : error.message;
    return jsonFail(error.httpStatus, error.code, message);
  }

  if (isAdminWriteError(error)) {
    return jsonFail(error.httpStatus, error.code, error.message, error.details);
  }

  return jsonFail(500, "INTERNAL_ERROR", "Unexpected server error.");
}

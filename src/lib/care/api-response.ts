import "server-only";

import { NextResponse } from "next/server";
import { CareOwnershipError } from "@/lib/care/ownership";

export class CareApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function careJsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function careJsonFail(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
}

/** Never leaks DB internals or PII. */
export function careJsonFromError(error: unknown): NextResponse {
  if (error instanceof CareApiError) {
    return careJsonFail(error.status, error.code, error.message);
  }
  if (error instanceof CareOwnershipError) {
    return careJsonFail(404, "NOT_FOUND", "리소스를 찾을 수 없습니다.");
  }
  return careJsonFail(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
}

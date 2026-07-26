import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { jsonFail, jsonOk } from "@/lib/admin/api-response";
import { handleCheckinEmailTestSend } from "@/lib/admin/checkinEmailTestSendHandler";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async () => {
  return jsonFail(405, "METHOD_NOT_ALLOWED", "POST만 허용됩니다.");
});

export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return jsonFail(400, "INVALID_JSON", "JSON body가 필요합니다.");
  }

  const result = await handleCheckinEmailTestSend({
    env: process.env,
    session: { userId: session.userId },
    headers: {
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      host: request.headers.get("host"),
      "content-type": request.headers.get("content-type"),
    },
    body,
  });

  if (result.body && typeof result.body === "object" && "ok" in result.body) {
    const payload = result.body as {
      ok: boolean;
      data?: unknown;
      error?: { code: string; message: string };
    };
    if (payload.ok && payload.data !== undefined) {
      return jsonOk(payload.data, result.status);
    }
    if (!payload.ok && payload.error) {
      return jsonFail(
        result.status,
        payload.error.code,
        payload.error.message
      );
    }
  }

  return jsonFail(500, "INTERNAL_ERROR", "Unexpected handler response.");
});

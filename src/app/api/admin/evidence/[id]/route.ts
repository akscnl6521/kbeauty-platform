import { NextResponse, type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import { isAdminWriteError } from "@/lib/admin/write-errors";
import { reviewAdminEvidence } from "@/lib/admin/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * PATCH /api/admin/evidence/[id]
 * body: { action: "approve" | "reject" | "needs_review" }
 */
export const PATCH = withAdminAuth(
  async (request: NextRequest, context: RouteContext, session) => {
    try {
      const params = (await context.params) ?? {};
      const rawId = params.id;
      const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
      const body = (await request.json().catch(() => null)) as unknown;
      const action =
        body && typeof body === "object"
          ? (body as { action?: unknown }).action
          : undefined;
      const result = await reviewAdminEvidence(
        session,
        String(idValue ?? ""),
        action
      );
      return NextResponse.json({ ok: true, data: result });
    } catch (error) {
      if (isAdminAuthError(error)) {
        return NextResponse.json(
          { ok: false, error: { code: error.code, message: error.message } },
          { status: error.httpStatus }
        );
      }
      if (isAdminWriteError(error)) {
        return NextResponse.json(
          {
            ok: false,
            error: { code: error.code, message: error.message },
          },
          { status: error.httpStatus }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "EVIDENCE_REVIEW_FAILED",
            message: "Unable to review evidence.",
          },
        },
        { status: 500 }
      );
    }
  },
  ["admin", "reviewer"] as const
);

import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import { isAdminWriteError } from "@/lib/admin/write-errors";
import {
  createAdminEvidence,
  listAdminEvidence,
  parseAdminEvidenceListParams,
} from "@/lib/admin/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/evidence — list ingredient_evidence
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const params = parseAdminEvidenceListParams(request.nextUrl.searchParams);
    const result = await listAdminEvidence(params);
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
          code: "EVIDENCE_UNAVAILABLE",
          message: "Unable to load evidence list.",
        },
      },
      { status: 503 }
    );
  }
}, ADMIN_ROLES);

/**
 * POST /api/admin/evidence — create evidence (researcher/admin)
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const input =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const created = await createAdminEvidence(session, input);
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
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
          code: "EVIDENCE_CREATE_FAILED",
          message: "Unable to create evidence.",
        },
      },
      { status: 500 }
    );
  }
}, ["admin", "researcher"] as const);

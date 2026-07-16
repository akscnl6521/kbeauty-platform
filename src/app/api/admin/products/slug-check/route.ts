import { NextResponse, type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeManualSlug } from "@/lib/admin/productSlug";
import type { AdminRole } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ_ROLES: AdminRole[] = [
  "admin",
  "reviewer",
  "researcher",
  "catalog_manager",
  "read_only",
];

/**
 * Check whether a product slug is already used (read-only).
 * Does not expose secrets.
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const raw = request.nextUrl.searchParams.get("slug") ?? "";
    const slug = normalizeManualSlug(raw);
    if (!slug) {
      return NextResponse.json({
        ok: true,
        data: { slug: "", available: false, reason: "empty" as const },
      });
    }

    const client = createSupabaseAdminClient();
    const { data, error } = await client
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "SLUG_CHECK_FAILED",
            message: "제품 주소(slug) 중복 확인에 실패했습니다.",
          },
        },
        { status: 503 }
      );
    }

    const existingId = data?.id != null ? Number(data.id) : null;
    return NextResponse.json({
      ok: true,
      data: {
        slug,
        available: existingId == null,
        existingProductId: existingId,
      },
    });
  } catch (error) {
    if (isAdminAuthError(error)) {
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
          code: "SLUG_CHECK_FAILED",
          message: "제품 주소(slug) 중복 확인에 실패했습니다.",
        },
      },
      { status: 503 }
    );
  }
}, READ_ROLES);

import { NextRequest, NextResponse } from "next/server";
import { getUnifiedReviewManifest, type ReviewPriority, type ReviewSource } from "@/lib/admin/unified-review";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = new Set<ReviewSource>([
  "catalog_refresh",
  "catalog_exception",
  "clinic_review",
]);
const PRIORITIES = new Set<ReviewPriority>(["critical", "high", "medium", "low"]);

/** Read-only unified review feed. No mutation, publish, or Production operation. */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const manifest = await getUnifiedReviewManifest();
    const sourceParam = request.nextUrl.searchParams.get("source");
    const priorityParam = request.nextUrl.searchParams.get("priority");
    const query = request.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase("ko-KR") ?? "";

    const source = SOURCES.has(sourceParam as ReviewSource)
      ? (sourceParam as ReviewSource)
      : null;
    const priority = PRIORITIES.has(priorityParam as ReviewPriority)
      ? (priorityParam as ReviewPriority)
      : null;

    const items = manifest.items.filter((item) => {
      if (source && item.source !== source) return false;
      if (priority && item.priority !== priority) return false;
      if (!query) return true;
      return `${item.id} ${item.title} ${JSON.stringify(item.payload)}`
        .toLocaleLowerCase("ko-KR")
        .includes(query);
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...manifest,
        total: items.length,
        items,
        filters: { source, priority, q: query || null },
      },
    });
  } catch (error) {
    if (isAdminAuthError(error)) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNIFIED_REVIEW_UNAVAILABLE",
          message: "Unable to load unified review data.",
        },
      },
      { status: 503 },
    );
  }
}, ADMIN_ROLES);

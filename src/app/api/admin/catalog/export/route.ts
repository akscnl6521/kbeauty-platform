import { NextResponse, type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError } from "@/lib/auth/errors";
import {
  buildCatalogAdminCsv,
  filterCatalogAuditProducts,
  loadCatalogAuditReport,
} from "@/lib/admin/catalog-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only filtered catalog CSV (no secrets / PII). */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    const report = await loadCatalogAuditReport();
    const filtered = filterCatalogAuditProducts(report, {
      status: sp.get("status"),
      brand: sp.get("brand"),
      search: sp.get("search"),
      productId: sp.get("id"),
      priority: sp.get("priority"),
    });
    const csv = buildCatalogAdminCsv(filtered);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="catalog-audit-filtered.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isAdminAuthError(error)) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.httpStatus }
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: "CATALOG_EXPORT_UNAVAILABLE" } },
      { status: 503 }
    );
  }
});

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import type { AdminRole } from "@/lib/auth/roles";
import { buildProductBulkTemplateCsv } from "@/lib/admin/product-bulk/parseSpreadsheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ_ROLES: AdminRole[] = [
  "admin",
  "reviewer",
  "researcher",
  "catalog_manager",
  "read_only",
];

export const GET = withAdminAuth(async () => {
  const csv = buildProductBulkTemplateCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="kbeauty-product-bulk-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}, READ_ROLES);

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError, AdminConfigurationError } from "@/lib/auth/errors";
import { ADMIN_ROLE_CAPABILITIES, type AdminRole } from "@/lib/auth/roles";
import { commitProductBulkImport } from "@/lib/admin/product-bulk/commit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_ROLES: AdminRole[] = ["admin", "catalog_manager"];

export const POST = withAdminAuth(async (request, _ctx, session) => {
  try {
    const caps = ADMIN_ROLE_CAPABILITIES[session.role];
    if (!caps.canManageCatalog) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "FORBIDDEN", message: "카탈로그 등록 권한이 필요합니다." },
        },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const sheet = form.get("spreadsheet");
    const zip = form.get("imagesZip");
    const selectedRaw = String(form.get("selectedRowIndexes") ?? "[]");

    let selectedRowIndexes: number[] = [];
    try {
      const parsed = JSON.parse(selectedRaw) as unknown;
      if (Array.isArray(parsed)) {
        selectedRowIndexes = parsed
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n));
      }
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_SELECTION",
            message: "선택한 행 정보가 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    if (!sheet || typeof sheet === "string" || !("arrayBuffer" in sheet)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MISSING_FILE",
            message: "CSV 또는 Excel 파일을 다시 선택해 주세요.",
          },
        },
        { status: 400 }
      );
    }

    const sheetFile = sheet as File;
    const spreadsheetBytes = Buffer.from(await sheetFile.arrayBuffer());
    let zipBytes: Buffer | null = null;
    if (zip && typeof zip !== "string" && "arrayBuffer" in zip) {
      const z = zip as File;
      if (z.size > 0) zipBytes = Buffer.from(await z.arrayBuffer());
    }

    const result = await commitProductBulkImport({
      spreadsheetBytes,
      spreadsheetName: sheetFile.name || "upload.csv",
      zipBytes,
      selectedRowIndexes,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (isAdminAuthError(error)) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.httpStatus }
      );
    }
    if (error instanceof AdminConfigurationError) {
      return NextResponse.json(
        { ok: false, error: { code: "COMMIT_FAILED", message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "COMMIT_FAILED",
          message: "일괄등록에 실패했습니다. 선택 항목을 확인해 주세요.",
        },
      },
      { status: 500 }
    );
  }
}, WRITE_ROLES);

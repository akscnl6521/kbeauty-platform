import { NextResponse, type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { isAdminAuthError, AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminProducts,
  parseAdminProductListParams,
} from "@/lib/admin/products";
import { createAdminProduct } from "@/lib/admin/createAdminProduct";
import type { AdminRole } from "@/lib/auth/roles";
import { ADMIN_ROLE_CAPABILITIES } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ_ROLES: AdminRole[] = [
  "admin",
  "reviewer",
  "researcher",
  "catalog_manager",
  "read_only",
];

const WRITE_ROLES: AdminRole[] = ["admin", "catalog_manager"];

/**
 * Read-only admin product list.
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const params = parseAdminProductListParams(request.nextUrl.searchParams);
    const result = await getAdminProducts(params);

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
          code: "PRODUCTS_UNAVAILABLE",
          message: "Unable to load admin products.",
        },
      },
      { status: 503 }
    );
  }
}, READ_ROLES);

/**
 * Create a product on Staging only (gated). Multipart form:
 * brand, name, nameKo?, category, description?, usageArea?,
 * fullIngredientsText, officialProductUrl?, publishForPreview?, image?
 */
export const POST = withAdminAuth(async (request, _context, session) => {
  try {
    const caps = ADMIN_ROLE_CAPABILITIES[session.role];
    if (!caps.canManageCatalog) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Catalog write permission required.",
          },
        },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const brand = String(form.get("brand") ?? "");
    const name = String(form.get("name") ?? "");
    const nameKo = String(form.get("nameKo") ?? "");
    const category = String(form.get("category") ?? "");
    const description = String(form.get("description") ?? "");
    const usageArea = String(form.get("usageArea") ?? "");
    const slug = String(form.get("slug") ?? "");
    const fullIngredientsText = String(form.get("fullIngredientsText") ?? "");
    const officialProductUrl = String(form.get("officialProductUrl") ?? "");
    const publishRaw = String(form.get("publishForPreview") ?? "true");
    const file = form.get("image");

    let image:
      | { bytes: Buffer; mimeType: string; fileName: string }
      | null = null;
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const blob = file as File;
      if (blob.size > 0) {
        const buf = Buffer.from(await blob.arrayBuffer());
        image = {
          bytes: buf,
          mimeType: blob.type || "application/octet-stream",
          fileName: blob.name || "upload.jpg",
        };
      }
    }

    const result = await createAdminProduct({
      brand,
      name,
      nameKo: nameKo || undefined,
      category,
      description: description || undefined,
      usageArea: usageArea || undefined,
      slug: slug || undefined,
      fullIngredientsText,
      officialProductUrl: officialProductUrl || undefined,
      image,
      publishForPreview: publishRaw !== "false",
    });

    if (result.duplicateBlocked) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "DUPLICATE_PRODUCT",
            message:
              "같은 제품 주소(slug) 또는 같은 브랜드·제품명이 이미 등록되어 있습니다. 다른 제품명이나 slug로 바꿔 주세요.",
            productId: result.productId,
            slug: result.slug,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, data: result });
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
    if (error instanceof AdminConfigurationError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "CONFIG_OR_GATE", message: error.message },
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PRODUCT_CREATE_FAILED",
          message: "제품 등록에 실패했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.",
        },
      },
      { status: 500 }
    );
  }
}, WRITE_ROLES);

import * as XLSX from "xlsx";
import {
  cell,
  normalizeHeader,
  resolveBulkSlug,
} from "@/lib/admin/product-bulk/cells";
import {
  PRODUCT_BULK_MAX_ROWS,
  type ProductBulkParsedRow,
} from "@/lib/admin/product-bulk/types";

export class ProductBulkParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductBulkParseError";
  }
}

function rowsFromSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
}

function mapRow(
  raw: Record<string, unknown>,
  rowIndex: number
): ProductBulkParsedRow {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    mapped[normalizeHeader(key)] = cell(value);
  }

  const brand = mapped.brand || "";
  const productName =
    mapped.product_name || mapped.name || mapped.productname || "";
  const slug = resolveBulkSlug(brand, productName, mapped.slug || "");

  return {
    rowIndex,
    brand,
    productName,
    productNameKo: mapped.product_name_ko || "",
    slug,
    category: mapped.category || "",
    targetAreas: mapped.target_areas || mapped.target_area || "",
    fullIngredients: mapped.full_ingredients || mapped.ingredients || "",
    description: mapped.description || "",
    imageFilename: mapped.image_filename || mapped.image_file || "",
    imageUrl: mapped.image_url || "",
    sourceUrl: mapped.source_url || "",
    sourceType: mapped.source_type || "",
    verified: mapped.verified || "",
    active: mapped.active || "",
    country: mapped.country || "",
    size: mapped.size || "",
    usage: mapped.usage || "",
    warnings: mapped.warnings || "",
    productNameEn: mapped.product_name_en || "",
    productNameJa: mapped.product_name_ja || "",
  };
}

/**
 * Parse CSV or XLSX buffer into normalized product rows (max 50).
 */
export function parseProductBulkSpreadsheet(
  bytes: Buffer,
  fileName: string
): ProductBulkParsedRow[] {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    throw new ProductBulkParseError(
      "CSV 또는 Excel(xlsx) 파일만 업로드할 수 있습니다."
    );
  }

  const workbook = XLSX.read(bytes, { type: "buffer", raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ProductBulkParseError("파일에 시트가 없습니다.");
  }
  const sheet = workbook.Sheets[sheetName];
  const jsonRows = rowsFromSheet(sheet);
  if (jsonRows.length === 0) {
    throw new ProductBulkParseError("파일에 데이터 행이 없습니다.");
  }
  if (jsonRows.length > PRODUCT_BULK_MAX_ROWS) {
    throw new ProductBulkParseError(
      `한 번에 최대 ${PRODUCT_BULK_MAX_ROWS}개 제품까지 등록할 수 있습니다. (현재 ${jsonRows.length}행)`
    );
  }

  return jsonRows.map((row, i) => mapRow(row, i + 2)); // header = row 1
}

export function buildProductBulkTemplateCsv(): string {
  const headers = [
    "brand",
    "product_name",
    "slug",
    "category",
    "target_areas",
    "full_ingredients",
    "description",
    "image_filename",
    "product_name_ko",
    "product_name_en",
    "product_name_ja",
    "country",
    "size",
    "usage",
    "warnings",
    "source_url",
    "source_type",
    "verified",
    "active",
    "image_url",
  ];
  const sample = [
    "ExampleBrand",
    "Sample Hydrating Serum",
    "examplebrand-sample-hydrating-serum",
    "serum",
    "face",
    "Water, Glycerin, Niacinamide, Panthenol",
    "보습 세럼 예시(가짜 대량 등록용 아님)",
    "sample-serum.jpg",
    "샘플 보습 세럼",
    "",
    "",
    "KR",
    "50ml",
    "아침저녁",
    "",
    "https://example.com/product",
    "admin_entry",
    "true",
    "true",
    "",
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return `${headers.join(",")}\n${sample.map(esc).join(",")}\n`;
}

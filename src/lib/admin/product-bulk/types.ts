/**
 * Shared types for admin product bulk import (safe for client + server).
 */

export const PRODUCT_BULK_MAX_ROWS = 50;

export const PRODUCT_BULK_REQUIRED_COLUMNS = [
  "brand",
  "product_name",
  "slug",
  "category",
  "target_areas",
  "full_ingredients",
  "description",
  "image_filename",
] as const;

export const PRODUCT_BULK_OPTIONAL_COLUMNS = [
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
] as const;

export type ProductBulkRowStatus =
  | "ready"
  | "missing_required"
  | "slug_duplicate"
  | "brand_name_duplicate"
  | "source_url_duplicate"
  | "image_hash_duplicate"
  | "image_missing"
  | "image_format_error"
  | "ingredients_empty"
  | "ingredients_parse_error"
  | "key_ingredients_ok"
  | "needs_review";

export type ProductBulkParsedRow = {
  rowIndex: number;
  brand: string;
  productName: string;
  productNameKo: string;
  slug: string;
  category: string;
  targetAreas: string;
  fullIngredients: string;
  description: string;
  imageFilename: string;
  imageUrl: string;
  sourceUrl: string;
  sourceType: string;
  verified: string;
  active: string;
  country: string;
  size: string;
  usage: string;
  warnings: string;
  productNameEn: string;
  productNameJa: string;
};

export type ProductBulkPreviewItem = ProductBulkParsedRow & {
  statuses: ProductBulkRowStatus[];
  statusLabels: string[];
  selectedByDefault: boolean;
  canRegister: boolean;
  ingredientCount: number;
  keyIngredientPreview: string[];
  imageMatched: boolean;
  imageBytes: number;
  imageHash: string | null;
  imageError: string | null;
  duplicateProductId: number | null;
  messages: string[];
};

export type ProductBulkPreviewSummary = {
  total: number;
  ready: number;
  blocked: number;
  warnings: number;
  estimatedImageBytes: number;
  maxRows: number;
};

export type ProductBulkPreviewResult = {
  items: ProductBulkPreviewItem[];
  summary: ProductBulkPreviewSummary;
};

export type ProductBulkCommitItemResult = {
  rowIndex: number;
  ok: boolean;
  productId: number | null;
  slug: string;
  brand: string;
  productName: string;
  message: string;
  keyIngredients: string[];
  fullIngredientCount: number;
  warnings: string[];
};

export const PRODUCT_BULK_STATUS_LABELS: Record<ProductBulkRowStatus, string> = {
  ready: "등록 가능",
  missing_required: "필수값 누락",
  slug_duplicate: "slug 중복",
  brand_name_duplicate: "브랜드+제품명 중복",
  source_url_duplicate: "출처 URL 중복",
  image_hash_duplicate: "이미지 해시 중복",
  image_missing: "이미지 없음",
  image_format_error: "이미지 형식 오류",
  ingredients_empty: "전성분 없음",
  ingredients_parse_error: "전성분 파싱 오류",
  key_ingredients_ok: "주요 성분 추출 가능",
  needs_review: "검토 필요",
};

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { isSafeHttpsUrl } from "@/lib/admin/query";
import {
  catalogMediaStatusLabel,
  evaluateCatalogProductMediaDisplay,
  type AdminCatalogMediaChecklist,
} from "@/lib/admin/product-usage-media-eligibility";

export {
  evaluateCatalogProductMediaDisplay,
  type AdminCatalogMediaChecklist,
} from "@/lib/admin/product-usage-media-eligibility";

/** Columns that exist on public.catalog_product_media (migration 20260714040000). */
export const CATALOG_PRODUCT_MEDIA_SELECT = [
  "id",
  "staging_product_id",
  "product_id",
  "source_id",
  "media_type",
  "variant_key",
  "shade_name",
  "image_url",
  "canonical_image_url",
  "thumbnail_url",
  "source_page_url",
  "source_domain",
  "source_type",
  "source_tier",
  "is_official_source",
  "usage_rights_status",
  "rights_notes",
  "width",
  "height",
  "mime_type",
  "content_length",
  "http_status",
  "is_accessible",
  "is_primary",
  "display_order",
  "verified_at",
  "last_checked_at",
  "validation_status",
  "validation_errors",
  "is_fixture",
  "created_at",
  "updated_at",
].join(", ");

/** Documented gaps vs Master Plan usage-video model (do not query these). */
export const USAGE_MEDIA_SCHEMA_GAPS = [
  "rights_starts_at / rights_ends_at (권리 시작·종료일)",
  "disclosure_text / is_sponsored (광고·협찬 고지 전용 컬럼)",
  "locale / country (미디어 언어·국가)",
  "duration_seconds (영상 길이)",
  "routine_step (루틴 단계)",
  "application_area_tags / skin_concern_tags",
  "active / published (게시 플래그 — validation_status로 대체 검수)",
  "product_usage_guides 전용 테이블 (사용 가이드는 LocalStorage 정책 레이어)",
] as const;

export type AdminCatalogMediaReviewItem = {
  id: string;
  productId: number | null;
  stagingProductId: string | null;
  sourceId: string | null;
  mediaType: string;
  variantKey: string | null;
  shadeName: string | null;
  imageUrl: string;
  imageUrlSafeHttps: boolean;
  canonicalImageUrl: string | null;
  canonicalImageUrlSafeHttps: boolean;
  thumbnailUrl: string | null;
  sourcePageUrl: string;
  sourcePageUrlSafeHttps: boolean;
  sourceDomain: string;
  sourceType: string;
  sourceTier: number;
  isOfficialSource: boolean;
  usageRightsStatus: string;
  rightsNotes: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  contentLength: number | null;
  httpStatus: number | null;
  isAccessible: boolean;
  isPrimary: boolean;
  displayOrder: number;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  validationStatus: string;
  validationErrors: unknown;
  isFixture: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  checklist: AdminCatalogMediaChecklist;
  displayEligible: boolean;
  ineligibilityReasons: string[];
  statusLabel: string;
};

export type AdminProductUsageMediaReview = {
  items: AdminCatalogMediaReviewItem[];
  loadError: string | null;
  schemaGaps: readonly string[];
  /** Dedicated usage-guide table is not in DB. */
  usageGuideTablePresent: false;
};

function mapRow(raw: Record<string, unknown>): AdminCatalogMediaReviewItem {
  const imageUrl = String(raw.image_url ?? "");
  const canonical =
    typeof raw.canonical_image_url === "string" ? raw.canonical_image_url : null;
  const sourcePageUrl = String(raw.source_page_url ?? "");
  const productId =
    raw.product_id == null || raw.product_id === ""
      ? null
      : Number(raw.product_id);

  const evaluation = evaluateCatalogProductMediaDisplay({
    productId: Number.isFinite(productId as number) ? (productId as number) : null,
    imageUrl,
    canonicalImageUrl: canonical,
    sourcePageUrl,
    sourceType: String(raw.source_type ?? ""),
    usageRightsStatus: String(raw.usage_rights_status ?? "unknown"),
    validationStatus: String(raw.validation_status ?? "discovered"),
    verifiedAt: typeof raw.verified_at === "string" ? raw.verified_at : null,
    rightsNotes: typeof raw.rights_notes === "string" ? raw.rights_notes : null,
  });

  return {
    id: String(raw.id),
    productId: Number.isFinite(productId as number) ? (productId as number) : null,
    stagingProductId:
      typeof raw.staging_product_id === "string" ? raw.staging_product_id : null,
    sourceId: typeof raw.source_id === "string" ? raw.source_id : null,
    mediaType: String(raw.media_type ?? ""),
    variantKey: typeof raw.variant_key === "string" ? raw.variant_key : null,
    shadeName: typeof raw.shade_name === "string" ? raw.shade_name : null,
    imageUrl,
    imageUrlSafeHttps: isSafeHttpsUrl(imageUrl),
    canonicalImageUrl: canonical,
    canonicalImageUrlSafeHttps: isSafeHttpsUrl(canonical),
    thumbnailUrl: typeof raw.thumbnail_url === "string" ? raw.thumbnail_url : null,
    sourcePageUrl,
    sourcePageUrlSafeHttps: isSafeHttpsUrl(sourcePageUrl),
    sourceDomain: String(raw.source_domain ?? ""),
    sourceType: String(raw.source_type ?? ""),
    sourceTier: Number(raw.source_tier ?? 0),
    isOfficialSource: raw.is_official_source === true,
    usageRightsStatus: String(raw.usage_rights_status ?? "unknown"),
    rightsNotes: typeof raw.rights_notes === "string" ? raw.rights_notes : null,
    width: typeof raw.width === "number" ? raw.width : null,
    height: typeof raw.height === "number" ? raw.height : null,
    mimeType: typeof raw.mime_type === "string" ? raw.mime_type : null,
    contentLength:
      typeof raw.content_length === "number" ? raw.content_length : null,
    httpStatus: typeof raw.http_status === "number" ? raw.http_status : null,
    isAccessible: raw.is_accessible === true,
    isPrimary: raw.is_primary === true,
    displayOrder: Number(raw.display_order ?? 0),
    verifiedAt: typeof raw.verified_at === "string" ? raw.verified_at : null,
    lastCheckedAt:
      typeof raw.last_checked_at === "string" ? raw.last_checked_at : null,
    validationStatus: String(raw.validation_status ?? ""),
    validationErrors: raw.validation_errors ?? [],
    isFixture: raw.is_fixture === true,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
    checklist: evaluation.checklist,
    displayEligible: evaluation.displayEligible,
    ineligibilityReasons: evaluation.ineligibilityReasons,
    statusLabel: catalogMediaStatusLabel(
      String(raw.validation_status ?? ""),
      String(raw.usage_rights_status ?? "")
    ),
  };
}

/**
 * Read-only SELECT of catalog_product_media for one product.
 * Distinguishes query/permission errors from an empty result set.
 */
export async function getAdminProductUsageMediaReview(
  productId: number
): Promise<AdminProductUsageMediaReview> {
  if (!Number.isSafeInteger(productId) || productId < 1) {
    return {
      items: [],
      loadError: "invalid_product_id",
      schemaGaps: USAGE_MEDIA_SCHEMA_GAPS,
      usageGuideTablePresent: false,
    };
  }

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError(
      "Unable to load admin usage media review."
    );
  }

  const { data, error } = await client
    .from("catalog_product_media")
    .select(CATALOG_PRODUCT_MEDIA_SELECT)
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("display_order", { ascending: true });

  if (error) {
    return {
      items: [],
      loadError: error.message || "catalog_product_media_query_failed",
      schemaGaps: USAGE_MEDIA_SCHEMA_GAPS,
      usageGuideTablePresent: false,
    };
  }

  const items = (data ?? []).map((row) =>
    mapRow(row as unknown as Record<string, unknown>)
  );

  return {
    items,
    loadError: null,
    schemaGaps: USAGE_MEDIA_SCHEMA_GAPS,
    usageGuideTablePresent: false,
  };
}

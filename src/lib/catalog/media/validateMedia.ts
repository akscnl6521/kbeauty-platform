/**
 * Official product media validation (URL/policy only — no live fetch on shared DB).
 */

export type MediaType =
  | "product_front"
  | "product_back"
  | "packaging"
  | "texture"
  | "swatch"
  | "shade_swatch"
  | "application"
  | "ingredient_label"
  | "size_reference"
  | "other";

export type UsageRightsStatus =
  | "official_remote_use"
  | "licensed_copy_allowed"
  | "external_link_only"
  | "unknown"
  | "prohibited";

export type MediaValidationStatus =
  | "discovered"
  | "verified"
  | "broken"
  | "mismatched"
  | "needs_review"
  | "prohibited";

export type MediaSourceType =
  | "official_brand"
  | "authorized_retailer"
  | "distributor"
  | "public_db"
  | "search_engine"
  | "user_ugc"
  | "ai_generated"
  | "unknown";

export type CatalogProductMediaDraft = {
  mediaType: MediaType;
  imageUrl: string;
  sourcePageUrl: string;
  sourceDomain: string;
  sourceType: MediaSourceType;
  sourceTier: 1 | 2 | 3 | 4;
  isOfficialSource: boolean;
  usageRightsStatus: UsageRightsStatus;
  validationStatus: MediaValidationStatus;
  isPrimary: boolean;
  displayOrder: number;
  shadeName?: string | null;
  variantKey?: string | null;
  contentHash?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  validationErrors: string[];
};

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1)/i;

const PLACEHOLDER_HINTS =
  /placeholder|spacer|1x1|pixel\.gif|tracking|banner_promo|category_banner/i;

export type MediaUrlValidation = {
  ok: boolean;
  status: MediaValidationStatus;
  errors: string[];
  sourceDomain: string | null;
};

/**
 * Structural URL validation only (no network). Safe on shared Production.
 */
export function validateProductMediaUrl(
  imageUrl: string,
  opts?: {
    sourcePageUrl?: string | null;
    allowStorageCopy?: boolean;
    sourceType?: MediaSourceType;
  }
): MediaUrlValidation {
  const errors: string[] = [];
  let sourceDomain: string | null = null;

  if (!imageUrl?.trim()) {
    return {
      ok: false,
      status: "broken",
      errors: ["missing_url"],
      sourceDomain: null,
    };
  }

  let url: URL;
  try {
    url = new URL(imageUrl.trim());
  } catch {
    return {
      ok: false,
      status: "broken",
      errors: ["invalid_url"],
      sourceDomain: null,
    };
  }

  sourceDomain = url.hostname.toLowerCase();

  if (url.protocol !== "https:") {
    errors.push("https_required");
  }
  if (url.username || url.password) {
    errors.push("url_credentials_forbidden");
  }
  if (PRIVATE_HOST.test(sourceDomain) || PRIVATE_HOST.test(url.hostname)) {
    errors.push("private_ip_or_localhost");
  }
  if (PLACEHOLDER_HINTS.test(url.pathname) || PLACEHOLDER_HINTS.test(imageUrl)) {
    errors.push("placeholder_or_tracking_pixel");
  }
  if (/\.svg(\?|$)/i.test(url.pathname)) {
    errors.push("svg_needs_review");
  }

  const st = opts?.sourceType ?? "unknown";
  if (st === "search_engine" || st === "user_ugc" || st === "ai_generated") {
    errors.push("prohibited_source_type");
  }
  if (st === "ai_generated") {
    errors.push("ai_image_forbidden_as_product_photo");
  }

  if (opts?.sourcePageUrl) {
    try {
      const page = new URL(opts.sourcePageUrl);
      // Soft check: different registrable host → needs_review (not auto fail)
      if (
        page.hostname.replace(/^www\./, "") !==
        sourceDomain.replace(/^www\./, "")
      ) {
        errors.push("image_host_differs_from_product_page");
      }
    } catch {
      errors.push("invalid_source_page_url");
    }
  }

  if (opts?.allowStorageCopy === true) {
    errors.push("storage_copy_requires_usage_rights_review");
  }

  const prohibited = errors.some((e) =>
    ["prohibited_source_type", "ai_image_forbidden_as_product_photo", "private_ip_or_localhost", "url_credentials_forbidden"].includes(
      e
    )
  );

  if (prohibited) {
    return { ok: false, status: "prohibited", errors, sourceDomain };
  }

  if (errors.includes("https_required") || errors.includes("invalid_url")) {
    return { ok: false, status: "broken", errors, sourceDomain };
  }

  if (errors.length > 0) {
    return { ok: false, status: "needs_review", errors, sourceDomain };
  }

  return { ok: true, status: "verified", errors: [], sourceDomain };
}

export function dedupeMediaByHash<T extends { contentHash?: string | null; imageUrl: string }>(
  items: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = (item.contentHash || item.imageUrl).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function isTrackingOrTinyPixel(input: {
  width?: number | null;
  height?: number | null;
  contentLength?: number | null;
}): boolean {
  if (
    input.width != null &&
    input.height != null &&
    input.width <= 2 &&
    input.height <= 2
  ) {
    return true;
  }
  if (input.contentLength != null && input.contentLength < 200) {
    return true;
  }
  return false;
}

export function buildProductImageAlt(input: {
  brand?: string | null;
  productName?: string | null;
  shadeName?: string | null;
}): string {
  const parts = [input.brand, input.productName, input.shadeName]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
  if (parts.length === 0) return "제품 이미지";
  return `${parts.join(" ")} 제품 이미지`;
}

export function mediaFallbackLabel(locale: "ko" | "en" | "ja" = "ko"): string {
  if (locale === "ja") return "製品画像準備中";
  if (locale === "en") return "Product image coming soon";
  return "제품 이미지 준비 중";
}

export function resolveUsageRights(sourceType: MediaSourceType): UsageRightsStatus {
  switch (sourceType) {
    case "official_brand":
      return "official_remote_use";
    case "authorized_retailer":
    case "distributor":
      return "external_link_only";
    case "search_engine":
    case "user_ugc":
    case "ai_generated":
      return "prohibited";
    default:
      return "unknown";
  }
}

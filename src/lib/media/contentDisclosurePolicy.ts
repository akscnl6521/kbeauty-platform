/**
 * Shared content disclosure policy (AI / ad / sponsorship / affiliate).
 * Pure — does not affect Organic ranking or rankProducts scores.
 */

export type ContentRelationship =
  | "organic"
  | "ai_generated"
  | "sponsored"
  | "advertisement"
  | "brand_provided"
  | "affiliate"
  | "creator_partner";

export type ContentDisclosureLocale = "ko" | "en" | "ja";

export type ContentDisclosureInput = {
  relationship: ContentRelationship;
  /** Explicit disclosure body provided with the asset (required when disclosure is needed). */
  disclosureText?: string | null;
  sponsorName?: string | null;
  /**
   * Optional relationship declared alongside disclosure text.
   * When set and mismatched with `relationship`, content is not eligible.
   */
  declaredRelationship?: ContentRelationship | null;
  sourceUrl?: string | null;
  /** Pre-checked HTTPS; if sourceUrl set and httpsOk false → blocked. */
  httpsOk?: boolean;
  verified?: boolean;
  rightsValid?: boolean;
  rightsNotExpired?: boolean;
  productLinked?: boolean;
  containsMedicalOverclaim?: boolean;
};

export type ContentDisclosureDecision = {
  relationship: ContentRelationship;
  requiresDisclosure: boolean;
  disclosureLabel: string | null;
  disclosureText: string | null;
  eligible: boolean;
  reasonCodes: string[];
};

const RELATIONSHIP_SET = new Set<ContentRelationship>([
  "organic",
  "ai_generated",
  "sponsored",
  "advertisement",
  "brand_provided",
  "affiliate",
  "creator_partner",
]);

const DISCLOSURE_COPY: Record<
  ContentDisclosureLocale,
  Record<
    Exclude<ContentRelationship, "organic">,
    { label: string; fallbackBody: string }
  > & { organicSource?: string }
> = {
  ko: {
    ai_generated: {
      label: "AI 생성 콘텐츠",
      fallbackBody:
        "AI 생성 콘텐츠입니다. 실제 사용 결과나 임상 효과처럼 오해되지 않도록 참고용으로만 보세요.",
    },
    sponsored: {
      label: "협찬",
      fallbackBody: "협찬이 포함되어 있습니다.",
    },
    advertisement: {
      label: "광고",
      fallbackBody: "광고입니다.",
    },
    brand_provided: {
      label: "브랜드 제공",
      fallbackBody: "브랜드가 제공한 콘텐츠입니다.",
    },
    affiliate: {
      label: "제휴 링크",
      fallbackBody:
        "구매 시 K-Beauty Match가 수수료를 받을 수 있습니다.",
    },
    creator_partner: {
      label: "크리에이터 파트너",
      fallbackBody: "크리에이터 파트너십이 포함된 콘텐츠입니다.",
    },
  },
  en: {
    ai_generated: {
      label: "AI-generated content",
      fallbackBody:
        "This content is AI-generated. It is for reference only and is not a real-use result or clinical claim.",
    },
    sponsored: {
      label: "Sponsored",
      fallbackBody: "This content includes sponsorship.",
    },
    advertisement: {
      label: "Advertisement",
      fallbackBody: "This is an advertisement.",
    },
    brand_provided: {
      label: "Brand-provided",
      fallbackBody: "This content was provided by the brand.",
    },
    affiliate: {
      label: "Affiliate link",
      fallbackBody:
        "K-Beauty Match may earn a commission if you buy through this link.",
    },
    creator_partner: {
      label: "Creator partner",
      fallbackBody: "This content includes a creator partnership.",
    },
  },
  ja: {
    ai_generated: {
      label: "AI生成コンテンツ",
      fallbackBody:
        "AI生成コンテンツです。実際の使用結果や臨床効果と誤解されないよう参考としてご覧ください。",
    },
    sponsored: {
      label: "スポンサー",
      fallbackBody: "スポンサーシップが含まれています。",
    },
    advertisement: {
      label: "広告",
      fallbackBody: "広告です。",
    },
    brand_provided: {
      label: "ブランド提供",
      fallbackBody: "ブランド提供のコンテンツです。",
    },
    affiliate: {
      label: "アフィリエイトリンク",
      fallbackBody:
        "このリンクからの購入で K-Beauty Match が手数料を受け取ることがあります。",
    },
    creator_partner: {
      label: "クリエイターパートナー",
      fallbackBody: "クリエイターパートナーシップを含むコンテンツです。",
    },
  },
};

export function isContentRelationship(value: unknown): value is ContentRelationship {
  return typeof value === "string" && RELATIONSHIP_SET.has(value as ContentRelationship);
}

export function contentRelationshipRequiresDisclosure(
  relationship: ContentRelationship
): boolean {
  return relationship !== "organic";
}

export function getContentDisclosureLabel(
  relationship: ContentRelationship,
  locale: ContentDisclosureLocale = "ko"
): string | null {
  if (relationship === "organic") return null;
  return DISCLOSURE_COPY[locale][relationship].label;
}

/**
 * Canonical body for a relationship. Used only when an explicit disclosureText
 * was supplied or when building UI after eligibility already passed with text.
 * Does not invent product-specific claims.
 */
export function getCanonicalDisclosureBody(
  relationship: ContentRelationship,
  locale: ContentDisclosureLocale = "ko",
  sponsorName?: string | null
): string | null {
  if (relationship === "organic") return null;
  const base = DISCLOSURE_COPY[locale][relationship].fallbackBody;
  if (
    (relationship === "sponsored" || relationship === "advertisement") &&
    sponsorName?.trim()
  ) {
    if (locale === "ko") return `${sponsorName.trim()} · ${base}`;
    if (locale === "ja") return `${sponsorName.trim()} · ${base}`;
    return `${sponsorName.trim()} · ${base}`;
  }
  return base;
}

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Map catalog_product_media.source_type to content relationship.
 * official_brand / authorized_retailer → organic (not advertisement).
 */
export function mapCatalogSourceTypeToRelationship(
  sourceType: string
): ContentRelationship {
  switch (sourceType) {
    case "ai_generated":
      return "ai_generated";
    case "user_ugc":
      return "creator_partner";
    case "official_brand":
    case "authorized_retailer":
    case "distributor":
    case "public_db":
      return "organic";
    default:
      return "organic";
  }
}

/**
 * Derive relationship from UsageMediaAsset-style flags without inventing new DB columns.
 */
export function deriveUsageMediaRelationship(input: {
  contentRelationship?: ContentRelationship | null;
  isSponsored?: boolean;
}): ContentRelationship {
  if (input.contentRelationship && isContentRelationship(input.contentRelationship)) {
    return input.contentRelationship;
  }
  if (input.isSponsored) return "sponsored";
  return "organic";
}

/**
 * Evaluate disclosure requirements and display eligibility for commercial/AI labels.
 * Safety flags (HTTPS, verified, rights, product link, medical overclaim) are optional
 * gates — omit them to evaluate disclosure-only rules.
 */
export function evaluateContentDisclosure(
  input: ContentDisclosureInput,
  locale: ContentDisclosureLocale = "ko"
): ContentDisclosureDecision {
  const reasons: string[] = [];
  const relationship = isContentRelationship(input.relationship)
    ? input.relationship
    : "organic";

  if (!isContentRelationship(input.relationship)) {
    reasons.push("relationship_invalid");
  }

  const requiresDisclosure = contentRelationshipRequiresDisclosure(relationship);
  const label = getContentDisclosureLabel(relationship, locale);

  if (
    input.declaredRelationship != null &&
    isContentRelationship(input.declaredRelationship) &&
    input.declaredRelationship !== relationship
  ) {
    reasons.push("disclosure_type_mismatch");
  }

  const provided = input.disclosureText?.trim() || null;
  let disclosureText: string | null = null;

  if (requiresDisclosure) {
    if (provided) {
      disclosureText = provided;
    } else if (relationship === "affiliate") {
      // Fixed legal affiliate notice is allowed (not product-claim invention).
      disclosureText = getCanonicalDisclosureBody("affiliate", locale);
    } else if (
      (relationship === "sponsored" || relationship === "advertisement") &&
      input.sponsorName?.trim()
    ) {
      disclosureText = getCanonicalDisclosureBody(
        relationship,
        locale,
        input.sponsorName
      );
    } else if (relationship === "brand_provided") {
      disclosureText = getCanonicalDisclosureBody("brand_provided", locale);
    } else {
      reasons.push("disclosure_missing");
    }
  }

  if (input.sourceUrl != null && input.sourceUrl.trim()) {
    const https =
      typeof input.httpsOk === "boolean"
        ? input.httpsOk
        : isHttpsUrl(input.sourceUrl);
    if (!https) reasons.push("https_required");
  } else if (input.httpsOk === false) {
    reasons.push("https_required");
  }

  if (input.verified === false) reasons.push("media_not_verified");
  if (input.rightsValid === false) reasons.push("rights_not_publishable");
  if (input.rightsNotExpired === false) reasons.push("rights_expired");
  if (input.productLinked === false) reasons.push("product_link_missing");
  if (input.containsMedicalOverclaim === true) {
    reasons.push("medical_overclaim_forbidden");
  }

  const eligible = reasons.length === 0;

  return {
    relationship,
    requiresDisclosure,
    disclosureLabel: requiresDisclosure ? label : null,
    disclosureText: eligible ? disclosureText : disclosureText,
    eligible,
    reasonCodes: [...new Set(reasons)],
  };
}

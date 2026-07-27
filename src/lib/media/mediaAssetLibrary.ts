/**
 * §36.4 media asset library — pure domain layer.
 *
 * Mirrors supabase/migrations/20260727120000_create_media_asset_library.sql.
 * No DB / server-only imports so self-tests can exercise it offline.
 *
 * Scope note: this track covers category-common assets (no product name attached).
 * Product-specific linking (product_videos) is modelled but deliberately unused.
 */
import {
  evaluateContentDisclosure,
  type ContentRelationship,
} from "@/lib/media/contentDisclosurePolicy";

export const MEDIA_ASSET_TYPES = [
  "product_usage",
  "category_usage",
  "routine_morning",
  "routine_evening",
  "routine_weekly",
  "routine_concern",
  "makeup_application",
  "base_makeup",
  "eye_makeup",
  "lip_makeup",
  "sun_care_amount",
  "scalp_hair_care",
  "texture_finish",
  "before_after_guide",
  "adverse_reaction_guide",
  "other",
] as const;
export type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];

export const MEDIA_ASSET_SCOPES = [
  "category_common",
  "product_specific",
  "brand_general",
] as const;
export type MediaAssetScope = (typeof MEDIA_ASSET_SCOPES)[number];

export const MEDIA_SOURCE_TYPES = [
  "official_brand",
  "authorized_retailer",
  "platform_original",
  "contracted_creator",
  "licensed_ugc",
] as const;
export type MediaSourceType = (typeof MEDIA_SOURCE_TYPES)[number];

/** Only these sources may ever have a stored copy (§36.3 무단 복제 금지). */
export const COPY_ALLOWED_SOURCE_TYPES: readonly MediaSourceType[] = [
  "platform_original",
  "contracted_creator",
];

export const MEDIA_VERIFICATION_STATUSES = [
  "draft",
  "needs_review",
  "approved",
  "rejected",
  "expired",
  "revoked",
] as const;
export type MediaVerificationStatus =
  (typeof MEDIA_VERIFICATION_STATUSES)[number];

export const MEDIA_RIGHTS_STATUSES = [
  "owned",
  "brand_permission",
  "retailer_permission",
  "licensed",
  "creator_contract",
  "user_consent",
  "embed_only",
  "unknown",
  "expired",
  "revoked",
] as const;
export type MediaRightsStatusValue = (typeof MEDIA_RIGHTS_STATUSES)[number];

export const ROUTINE_VIDEO_CONTEXTS = [
  "am_routine",
  "pm_routine",
  "weekly_routine",
  "concern_routine",
  "category_common",
] as const;
export type RoutineVideoContext = (typeof ROUTINE_VIDEO_CONTEXTS)[number];

export const EMBED_PROVIDERS = ["none", "youtube", "vimeo", "self_hosted"] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export const MEDIA_TIME_OF_DAY = [
  "am",
  "pm",
  "am_pm",
  "weekly",
  "as_needed",
] as const;
export type MediaTimeOfDay = (typeof MEDIA_TIME_OF_DAY)[number];

export type MediaAssetRecord = {
  id: string;
  assetType: MediaAssetType;
  mediaType: "video" | "animation" | "image";
  scope: MediaAssetScope;
  sourceType: MediaSourceType;
  sourceUrl: string | null;
  sourcePageUrl: string | null;
  storageUrl: string | null;
  embedProvider: EmbedProvider;
  embedId: string | null;
  title: string;
  language: string;
  country: string | null;
  durationSeconds: number | null;
  routineStep: string | null;
  timeOfDay: MediaTimeOfDay | null;
  categorySlug: string | null;
  concernTags: string[];
  bodyAreaTags: string[];
  contentRelationship: ContentRelationship;
  disclosure: string | null;
  isSponsored: boolean;
  sponsorName: string | null;
  isAiGenerated: boolean;
  containsMedicalClaim: boolean;
  containsBeforeAfter: boolean;
  showsProductName: boolean;
  verificationStatus: MediaVerificationStatus;
  verifiedAt: string | null;
  isAccessible: boolean;
};

export type MediaRightsRecord = {
  id: string;
  mediaAssetId: string;
  rightsStatus: MediaRightsStatusValue;
  rightsBasis: string;
  rightsHolder: string;
  allowsEmbed: boolean;
  allowsCopy: boolean;
  allowsDownload: boolean;
  allowsModification: boolean;
  rightsStartAt: string | null;
  rightsEndAt: string | null;
  isWorldwide: boolean;
  territoryCodes: string[];
  evidenceUrl: string | null;
  reviewDueAt: string | null;
};

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Rights grants that never permit display, whatever the dates say. */
const DEAD_RIGHTS_STATUSES = new Set<MediaRightsStatusValue>([
  "unknown",
  "expired",
  "revoked",
]);

export type RightsWindowState = "active" | "not_started" | "expired" | "dead";

export function evaluateRightsWindow(
  rights: Pick<
    MediaRightsRecord,
    "rightsStatus" | "rightsStartAt" | "rightsEndAt"
  >,
  now: Date = new Date()
): RightsWindowState {
  if (DEAD_RIGHTS_STATUSES.has(rights.rightsStatus)) return "dead";
  const start = parseDate(rights.rightsStartAt);
  const end = parseDate(rights.rightsEndAt);
  if (rights.rightsStartAt && !start) return "dead";
  if (rights.rightsEndAt && !end) return "dead";
  if (start && start.getTime() > now.getTime()) return "not_started";
  if (end && end.getTime() <= now.getTime()) return "expired";
  return "active";
}

/** Does a grant cover the requested territory? */
export function rightsCoverTerritory(
  rights: Pick<MediaRightsRecord, "isWorldwide" | "territoryCodes">,
  countryCode: string | null
): boolean {
  if (rights.isWorldwide) return true;
  if (!countryCode) return false;
  const wanted = countryCode.trim().toUpperCase();
  return rights.territoryCodes.some(
    (code) => code.trim().toUpperCase() === wanted
  );
}

export type MediaPublicationDecision = {
  publishable: boolean;
  reasonCodes: string[];
  requiresDisclosure: boolean;
  disclosureLabel: string | null;
  disclosureText: string | null;
  rightsWindow: RightsWindowState | "missing";
};

/**
 * Whether a library asset may be shown to an end user right now.
 *
 * Mirrors the media_assets_publishable view plus the checks a view cannot express
 * (territory match, copy legality, disclosure completeness). Nothing in this track
 * calls it for display — /admin/media-review shows the verdict to a human reviewer.
 */
export function decideMediaAssetPublication(
  asset: MediaAssetRecord,
  rights: readonly MediaRightsRecord[],
  options: { now?: Date; countryCode?: string | null } = {}
): MediaPublicationDecision {
  const now = options.now ?? new Date();
  const countryCode = options.countryCode ?? null;
  const reasons: string[] = [];

  // --- locator + transport ---------------------------------------------------
  if (!asset.sourceUrl && !asset.storageUrl) {
    reasons.push("media_source_missing");
  }
  if (asset.sourceUrl && !isHttpsUrl(asset.sourceUrl)) {
    reasons.push("https_required");
  }
  if (asset.storageUrl && !isHttpsUrl(asset.storageUrl)) {
    reasons.push("https_required");
  }
  if (
    asset.storageUrl &&
    !COPY_ALLOWED_SOURCE_TYPES.includes(asset.sourceType)
  ) {
    reasons.push("unauthorized_copy");
  }
  if (asset.embedProvider !== "none" && !asset.embedId) {
    reasons.push("embed_id_missing");
  }

  // --- review lifecycle ------------------------------------------------------
  if (asset.verificationStatus !== "approved") {
    reasons.push("media_not_approved");
  }
  if (asset.verificationStatus === "approved" && !asset.verifiedAt) {
    reasons.push("verified_at_missing");
  }
  if (!asset.isAccessible) reasons.push("media_unreachable");

  // --- content safety --------------------------------------------------------
  if (asset.containsMedicalClaim) reasons.push("medical_claim_forbidden");
  if (asset.containsBeforeAfter) reasons.push("before_after_manual_review");
  if (asset.scope === "category_common" && asset.showsProductName) {
    reasons.push("category_common_must_not_name_product");
  }
  if (asset.isAiGenerated && asset.contentRelationship !== "ai_generated") {
    reasons.push("ai_disclosure_missing");
  }

  // --- rights ----------------------------------------------------------------
  let rightsWindow: RightsWindowState | "missing" = "missing";
  if (rights.length === 0) {
    reasons.push("rights_record_missing");
  } else {
    const usable = rights.filter(
      (grant) =>
        evaluateRightsWindow(grant, now) === "active" &&
        grant.allowsEmbed &&
        rightsCoverTerritory(grant, countryCode)
    );
    if (usable.length > 0) {
      rightsWindow = "active";
      if (asset.storageUrl && !usable.some((grant) => grant.allowsCopy)) {
        reasons.push("copy_not_permitted");
      }
    } else {
      const windows = rights.map((grant) => evaluateRightsWindow(grant, now));
      if (windows.includes("expired")) {
        rightsWindow = "expired";
        reasons.push("rights_expired");
      } else if (windows.includes("not_started")) {
        rightsWindow = "not_started";
        reasons.push("rights_not_started");
      } else if (windows.includes("active")) {
        // in window, but embed not allowed or territory not covered
        rightsWindow = "active";
        const embedOk = rights.some(
          (grant) =>
            evaluateRightsWindow(grant, now) === "active" && grant.allowsEmbed
        );
        if (!embedOk) reasons.push("embed_not_permitted");
        else reasons.push("territory_not_covered");
      } else {
        rightsWindow = "dead";
        reasons.push("rights_not_publishable");
      }
    }
  }

  // --- disclosure ------------------------------------------------------------
  const disclosure = evaluateContentDisclosure({
    relationship: asset.contentRelationship,
    disclosureText: asset.disclosure,
    sponsorName: asset.sponsorName,
  });
  if (disclosure.reasonCodes.includes("disclosure_missing")) {
    reasons.push("disclosure_missing");
  }
  if (disclosure.reasonCodes.includes("disclosure_type_mismatch")) {
    reasons.push("disclosure_type_mismatch");
  }
  if (asset.isSponsored && !asset.disclosure) {
    reasons.push("sponsorship_disclosure_missing");
  }

  return {
    publishable: reasons.length === 0,
    reasonCodes: [...new Set(reasons)],
    requiresDisclosure: disclosure.requiresDisclosure,
    disclosureLabel: disclosure.disclosureLabel,
    disclosureText: disclosure.disclosureText,
    rightsWindow,
  };
}

/**
 * Reviewer checklist for /admin/media-review. Read-only judgment; the reviewer
 * decides, this only lays out what the record does and does not prove.
 */
export type MediaReviewChecklist = {
  httpsSource: boolean;
  officialSource: boolean;
  rightsRecorded: boolean;
  rightsWindowActive: boolean;
  rightsEvidencePresent: boolean;
  copyLegal: boolean;
  disclosureSatisfied: boolean;
  noMedicalClaim: boolean;
  categoryCommonClean: boolean;
  reachable: boolean;
};

const OFFICIAL_SOURCE_TYPES = new Set<MediaSourceType>([
  "official_brand",
  "authorized_retailer",
  "platform_original",
  "contracted_creator",
]);

export function buildMediaReviewChecklist(
  asset: MediaAssetRecord,
  rights: readonly MediaRightsRecord[],
  now: Date = new Date()
): MediaReviewChecklist {
  const decision = decideMediaAssetPublication(asset, rights, { now });
  return {
    httpsSource: isHttpsUrl(asset.sourceUrl) || isHttpsUrl(asset.storageUrl),
    officialSource: OFFICIAL_SOURCE_TYPES.has(asset.sourceType),
    rightsRecorded: rights.length > 0,
    rightsWindowActive: rights.some(
      (grant) => evaluateRightsWindow(grant, now) === "active"
    ),
    rightsEvidencePresent: rights.some((grant) => isHttpsUrl(grant.evidenceUrl)),
    copyLegal: !decision.reasonCodes.includes("unauthorized_copy"),
    disclosureSatisfied:
      !decision.reasonCodes.includes("disclosure_missing") &&
      !decision.reasonCodes.includes("disclosure_type_mismatch") &&
      !decision.reasonCodes.includes("sponsorship_disclosure_missing"),
    noMedicalClaim: !asset.containsMedicalClaim,
    categoryCommonClean:
      asset.scope !== "category_common" || !asset.showsProductName,
    reachable: asset.isAccessible,
  };
}

/** Assets whose rights expire inside `days` — feeds the §41 re-check cycle. */
export function findExpiringRights(
  rights: readonly MediaRightsRecord[],
  days: number,
  now: Date = new Date()
): MediaRightsRecord[] {
  const horizon = now.getTime() + days * 24 * 60 * 60 * 1000;
  return rights.filter((grant) => {
    const end = parseDate(grant.rightsEndAt);
    if (!end) return false;
    return end.getTime() > now.getTime() && end.getTime() <= horizon;
  });
}

export function isMediaAssetType(value: unknown): value is MediaAssetType {
  return (
    typeof value === "string" &&
    (MEDIA_ASSET_TYPES as readonly string[]).includes(value)
  );
}

export function isMediaSourceType(value: unknown): value is MediaSourceType {
  return (
    typeof value === "string" &&
    (MEDIA_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

export function isRoutineVideoContext(
  value: unknown
): value is RoutineVideoContext {
  return (
    typeof value === "string" &&
    (ROUTINE_VIDEO_CONTEXTS as readonly string[]).includes(value)
  );
}

export function isMediaVerificationStatus(
  value: unknown
): value is MediaVerificationStatus {
  return (
    typeof value === "string" &&
    (MEDIA_VERIFICATION_STATUSES as readonly string[]).includes(value)
  );
}

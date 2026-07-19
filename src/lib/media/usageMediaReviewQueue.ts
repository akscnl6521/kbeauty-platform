import { decideUsageMediaPublication, type UsageMediaAsset } from "./productUsageMediaPolicy";

export type UsageMediaReviewPriority = "critical" | "high" | "medium" | "low";

export type UsageMediaReviewReason =
  | "rights_revoked"
  | "rights_expired"
  | "rights_expiring_soon"
  | "rights_unknown"
  | "rights_evidence_missing"
  | "media_source_missing"
  | "medical_claim"
  | "before_after_manual_review"
  | "sponsorship_disclosure_missing"
  | "approval_required"
  | "product_match_unverified"
  | "application_demo_unverified";

export type UsageMediaReviewItem = {
  id: string;
  mediaId: string;
  productId: string;
  priority: UsageMediaReviewPriority;
  action: "unpublish" | "review" | "renew_rights";
  reasons: UsageMediaReviewReason[];
  rightsExpiresAt: string | null;
  sourceUrl: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const rank: Record<UsageMediaReviewPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function daysUntil(value: string | null, now: Date): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return -1;
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function classify(asset: UsageMediaAsset, now: Date): UsageMediaReviewItem | null {
  const decision = decideUsageMediaPublication(asset, now);
  const reasons: UsageMediaReviewReason[] = [];
  const remainingDays = daysUntil(asset.rightsExpiresAt, now);

  if (asset.rightsStatus === "revoked") reasons.push("rights_revoked");
  if (asset.rightsStatus === "expired" || remainingDays !== null && remainingDays <= 0) {
    reasons.push("rights_expired");
  } else if (remainingDays !== null && remainingDays <= 30) {
    reasons.push("rights_expiring_soon");
  }
  if (asset.rightsStatus === "unknown") reasons.push("rights_unknown");

  for (const code of decision.reasonCodes) {
    if (code === "rights_evidence_missing") reasons.push("rights_evidence_missing");
    if (code === "media_source_missing") reasons.push("media_source_missing");
    if (code === "medical_claim_requires_rejection") reasons.push("medical_claim");
    if (code === "before_after_requires_manual_review") reasons.push("before_after_manual_review");
    if (code === "sponsorship_disclosure_missing") reasons.push("sponsorship_disclosure_missing");
    if (code === "media_not_approved") reasons.push("approval_required");
    if (code === "product_match_unverified") reasons.push("product_match_unverified");
    if (code === "application_demo_unverified") reasons.push("application_demo_unverified");
  }

  const normalized = unique(reasons);
  if (normalized.length === 0) return null;

  const mustUnpublish = normalized.some((reason) =>
    ["rights_revoked", "rights_expired", "rights_unknown", "medical_claim", "media_source_missing"].includes(reason),
  );
  const renewRights = !mustUnpublish && normalized.includes("rights_expiring_soon");
  const priority: UsageMediaReviewPriority = mustUnpublish
    ? "critical"
    : renewRights
      ? "high"
      : normalized.some((reason) =>
            ["rights_evidence_missing", "sponsorship_disclosure_missing", "before_after_manual_review"].includes(reason),
          )
        ? "high"
        : "medium";

  return {
    id: `usage-media-${asset.id}`,
    mediaId: asset.id,
    productId: asset.productId,
    priority,
    action: mustUnpublish ? "unpublish" : renewRights ? "renew_rights" : "review",
    reasons: normalized,
    rightsExpiresAt: asset.rightsExpiresAt,
    sourceUrl: asset.sourceUrl,
  };
}

export function buildUsageMediaReviewQueue(
  assets: UsageMediaAsset[],
  now: Date = new Date(),
): UsageMediaReviewItem[] {
  return assets
    .map((asset) => classify(asset, now))
    .filter((item): item is UsageMediaReviewItem => Boolean(item))
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] ||
        a.productId.localeCompare(b.productId) ||
        a.mediaId.localeCompare(b.mediaId),
    );
}

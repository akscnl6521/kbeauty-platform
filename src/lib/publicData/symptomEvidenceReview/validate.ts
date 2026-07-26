/**
 * Validate manifest-entered symptom evidence rows.
 * Never attempts crawl/login/CAPTCHA.
 */

import { BLOCKED_ACCESS_MODES, REQUIRED_CLAIM_CATEGORIES } from "./constants";
import { findManifestEntry, isAllowedSourceKind } from "./manifest";
import type {
  RejectionReasonCode,
  SymptomClaimCategory,
  SymptomEvidenceManifestInput,
} from "./types";

function isIsoDate(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isSupportedClaimCategory(
  value: string,
): value is SymptomClaimCategory {
  return (REQUIRED_CLAIM_CATEGORIES as readonly string[]).includes(value);
}

export function collectRejectionCodes(
  input: SymptomEvidenceManifestInput,
  nowMs: number = Date.now(),
): RejectionReasonCode[] {
  const codes: RejectionReasonCode[] = [];
  const manifest = findManifestEntry(input.sourceId);

  if (!manifest) {
    codes.push("manifest_entry_missing");
  } else {
    if (!manifest.allowedForReviewQueue && !input.isFixture) {
      codes.push("source_kind_not_allowed");
    }
    if (
      manifest.kind !== "fixture_offline" &&
      !isAllowedSourceKind(manifest.kind) &&
      !input.isFixture
    ) {
      if (!codes.includes("source_kind_not_allowed")) {
        codes.push("source_kind_not_allowed");
      }
    }
  }

  if (BLOCKED_ACCESS_MODES.includes(input.accessMode)) {
    switch (input.accessMode) {
      case "blocked_auth_required":
        codes.push("login_automation_forbidden");
        break;
      case "blocked_captcha":
        codes.push("captcha_bypass_forbidden");
        break;
      case "blocked_restricted_crawl":
        codes.push("restricted_crawl_forbidden");
        break;
      case "blocked_terms_risk_scrape":
        codes.push("terms_risk_scrape_forbidden");
        break;
      case "blocked_paid_api":
        codes.push("paid_api_forbidden");
        break;
      default:
        break;
    }
  }

  if (!input.evidenceUrl?.trim()) {
    codes.push("evidence_url_missing");
  } else if (!isHttpUrl(input.evidenceUrl.trim()) && !input.isFixture) {
    codes.push("evidence_url_invalid");
  } else if (
    input.isFixture &&
    !isHttpUrl(input.evidenceUrl.trim()) &&
    !input.evidenceUrl.startsWith("fixture://")
  ) {
    codes.push("evidence_url_invalid");
  }

  if (!input.pageTitle?.trim()) {
    codes.push("page_title_missing");
  }

  if (!isSupportedClaimCategory(input.claimCategory)) {
    codes.push("claim_category_unsupported");
  }

  if (!input.excerptSummary?.trim()) {
    codes.push("excerpt_summary_missing");
  }

  if (!input.verifiedAt) {
    codes.push("verified_date_missing");
  } else if (!isIsoDate(input.verifiedAt)) {
    codes.push("verified_date_invalid");
  }

  if (!input.staleAt) {
    codes.push("stale_date_missing");
  } else if (isIsoDate(input.staleAt)) {
    const staleMs = Date.parse(input.staleAt);
    if (staleMs < nowMs && input.reviewerStatus !== "rejected") {
      codes.push("stale_beyond_policy");
    }
  }

  if (input.reviewerStatus === "rejected") {
    codes.push("reviewer_rejected");
    if (!input.rejectionReasonCode && !input.rejectionReasonKo) {
      codes.push("medical_claim_unverified");
    }
  }

  if (
    input.reviewerStatus !== "approved" &&
    input.reviewerStatus !== "rejected"
  ) {
    codes.push("unverified_must_stay_unpublished");
  }

  if (input.isFixture) {
    codes.push("fixture_cannot_publish");
  }

  if (
    input.commercialRelationship === "affiliate" ||
    input.commercialRelationship === "sponsored" ||
    input.commercialRelationship === "booking_fee" ||
    input.commercialRelationship === "lead_fee"
  ) {
    if (input.commercialRelationship === "affiliate") {
      codes.push("affiliate_as_organic_forbidden");
    }
    if (input.commercialRelationship === "sponsored") {
      codes.push("sponsored_as_organic_forbidden");
    }
  }

  return [...new Set(codes)];
}

export function hasHardBlock(codes: RejectionReasonCode[]): boolean {
  const hard: RejectionReasonCode[] = [
    "login_automation_forbidden",
    "captcha_bypass_forbidden",
    "restricted_crawl_forbidden",
    "terms_risk_scrape_forbidden",
    "paid_api_forbidden",
    "source_kind_not_allowed",
    "manifest_entry_missing",
    "evidence_url_missing",
    "evidence_url_invalid",
    "page_title_missing",
    "claim_category_unsupported",
    "excerpt_summary_missing",
    "verified_date_missing",
    "verified_date_invalid",
    "reviewer_rejected",
  ];
  return codes.some((c) => hard.includes(c));
}

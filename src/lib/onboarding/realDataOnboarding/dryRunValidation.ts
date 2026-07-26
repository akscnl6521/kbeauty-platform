/**
 * Dry-run validation for real-data onboarding rows.
 * Never writes DB; never marks fixtures as publicly visible.
 */

import {
  CLINIC_REQUIRED_PROVENANCE_FIELDS,
  PRODUCT_REQUIRED_PROVENANCE_FIELDS,
  hasOfficialProvenanceForField,
  summarizeProvenanceCompleteness,
} from "./fieldProvenance";
import { checklistForLane } from "./reviewChecklists";
import {
  findManifestByKind,
  isAccessModeBlocked,
  isOfficialPrioritySource,
} from "./sourceManifest";
import { evaluateStaleGroups } from "./staleRefreshRules";
import type {
  DryRunRowInput,
  DryRunValidationResult,
  OnboardingEligibility,
  RejectionReasonCode,
  SourceKind,
} from "./types";

const HTTPS = /^https:\/\//i;
const PLACEHOLDER_PRICE = /^(TODO|TBD|unknown|n\/?a|999999|invented)$/i;

function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function parseSourceKind(raw: string | null | undefined): SourceKind | null {
  if (!raw) return null;
  return raw as SourceKind;
}

function evaluateProductChecklistGaps(row: DryRunRowInput): string[] {
  const gaps: string[] = [];
  const f = row.fields;
  for (const item of checklistForLane("korean_product")) {
    switch (item.id) {
      case "kp-brand-name":
        if (!nonEmpty(f.brand) || !nonEmpty(f.product_name)) gaps.push(item.id);
        break;
      case "kp-official-source":
        if (!nonEmpty(f.official_source_url) || !HTTPS.test(f.official_source_url ?? "")) {
          gaps.push(item.id);
        }
        break;
      case "kp-full-inci":
        if (!nonEmpty(f.full_ingredients)) gaps.push(item.id);
        break;
      case "kp-sale-check":
        if (!nonEmpty(f.sale_page_url)) gaps.push(item.id);
        break;
      case "kp-no-invent":
        if (nonEmpty(f.price) && PLACEHOLDER_PRICE.test(f.price ?? "")) {
          gaps.push(item.id);
        }
        break;
      case "kp-provenance": {
        const prov = summarizeProvenanceCompleteness(
          row.provenance,
          PRODUCT_REQUIRED_PROVENANCE_FIELDS,
        );
        if (!prov.complete) gaps.push(item.id);
        break;
      }
      case "kp-no-paid-scrape":
        if (isAccessModeBlocked(row.accessMode)) gaps.push(item.id);
        break;
      case "kp-medical-boundary":
        if ((f.medical_claim ?? "").toLowerCase() === "unverified_yes") {
          gaps.push(item.id);
        }
        break;
      default:
        break;
    }
  }
  return gaps;
}

function evaluateClinicChecklistGaps(row: DryRunRowInput): string[] {
  const gaps: string[] = [];
  const f = row.fields;
  for (const item of checklistForLane("clinic_professional")) {
    switch (item.id) {
      case "cl-official-site":
        if (!nonEmpty(f.official_site_url) || !HTTPS.test(f.official_site_url ?? "")) {
          gaps.push(item.id);
        }
        break;
      case "cl-address-hours":
        if (!nonEmpty(f.address) || !nonEmpty(f.operating_hours)) gaps.push(item.id);
        break;
      case "cl-specialties":
        if (!nonEmpty(f.specialties) || !nonEmpty(f.symptom_tags)) gaps.push(item.id);
        break;
      case "cl-evidence-fresh":
        if (!nonEmpty(f.evidence_verified_at) && !row.lastVerifiedAt) gaps.push(item.id);
        break;
      case "cl-languages":
        if (!nonEmpty(f.languages)) gaps.push(item.id);
        break;
      case "cl-partner-disclosure":
        if ((f.is_partner ?? "").toLowerCase() === "true" && !nonEmpty(f.partnership_disclosure)) {
          gaps.push(item.id);
        }
        break;
      case "cl-fixture-block":
        if (row.isFixture) gaps.push(item.id);
        break;
      case "cl-no-invent":
        if ((f.invented ?? "").toLowerCase() === "true") gaps.push(item.id);
        break;
      default:
        break;
    }
  }
  return gaps;
}

function productRejections(row: DryRunRowInput): RejectionReasonCode[] {
  const reasons: RejectionReasonCode[] = [];
  const f = row.fields;
  const kind = row.sourceKind ?? parseSourceKind(f.source_kind);

  if (row.isFixture) reasons.push("fixture_cannot_publish");
  if (isAccessModeBlocked(row.accessMode)) {
    if (row.accessMode === "blocked_paid_api") reasons.push("paid_api_forbidden");
    if (row.accessMode === "blocked_auth_required") {
      reasons.push("authenticated_scrape_forbidden");
    }
    if (row.accessMode === "blocked_captcha") reasons.push("captcha_bypass_forbidden");
  }
  if (!nonEmpty(f.brand) || !nonEmpty(f.product_name)) {
    reasons.push("brand_or_name_missing");
  }
  if (!nonEmpty(f.full_ingredients)) reasons.push("full_inci_missing");
  if (!nonEmpty(f.official_source_url) || !HTTPS.test(f.official_source_url ?? "")) {
    reasons.push("official_source_missing");
  }
  if (kind === "marketplace_listing" || kind === "partner_feed") {
    reasons.push("official_source_not_priority");
  }
  if (kind && findManifestByKind("korean_product", kind)?.allowedForImport === false) {
    if (!reasons.includes("official_source_not_priority")) {
      reasons.push("official_source_not_priority");
    }
  }
  if (nonEmpty(f.price) && PLACEHOLDER_PRICE.test(f.price ?? "")) {
    reasons.push("price_or_stock_invented");
  }
  if ((f.invented ?? "").toLowerCase() === "true") {
    reasons.push("invented_data_forbidden");
  }
  if ((f.affiliate_as_organic ?? "").toLowerCase() === "true") {
    reasons.push("affiliate_as_organic_forbidden");
  }
  if ((f.medical_claim ?? "").toLowerCase() === "unverified_yes") {
    reasons.push("medical_claim_unverified");
  }
  if (!nonEmpty(f.sale_page_url)) reasons.push("sale_page_unverified");

  const prov = summarizeProvenanceCompleteness(
    row.provenance,
    PRODUCT_REQUIRED_PROVENANCE_FIELDS,
  );
  if (!prov.complete) reasons.push("field_provenance_incomplete");
  if (
    nonEmpty(f.official_source_url) &&
    !hasOfficialProvenanceForField(row.provenance, "official_source_url") &&
    kind &&
    !isOfficialPrioritySource(kind) &&
    kind !== "fixture_offline"
  ) {
    reasons.push("official_source_not_priority");
  }

  const stale = evaluateStaleGroups({
    lane: "korean_product",
    lastVerifiedAt: row.lastVerifiedAt,
    hasOfficialConfirmed: Boolean(
      kind && isOfficialPrioritySource(kind) && nonEmpty(f.official_source_url),
    ),
    fieldGroupsPresent: [
      "official_page",
      "full_inci",
      ...(nonEmpty(f.sale_page_url) ? ["sale_offer"] : []),
    ],
  });
  if (stale.blockPublish) reasons.push("stale_beyond_refresh_window");

  return [...new Set(reasons)];
}

function clinicRejections(row: DryRunRowInput): RejectionReasonCode[] {
  const reasons: RejectionReasonCode[] = [];
  const f = row.fields;

  if (row.isFixture) reasons.push("clinic_fixture_cannot_publish");
  if (isAccessModeBlocked(row.accessMode)) {
    if (row.accessMode === "blocked_paid_api") reasons.push("paid_api_forbidden");
    if (row.accessMode === "blocked_auth_required") {
      reasons.push("authenticated_scrape_forbidden");
    }
    if (row.accessMode === "blocked_captcha") reasons.push("captcha_bypass_forbidden");
  }
  if (!nonEmpty(f.clinic_name)) reasons.push("professional_listing_incomplete");
  if (!nonEmpty(f.specialties)) reasons.push("clinic_specialties_missing");
  if (!nonEmpty(f.symptom_tags)) reasons.push("clinic_symptom_tags_missing");
  if (!nonEmpty(f.address)) reasons.push("clinic_address_missing");
  if (!nonEmpty(f.operating_hours)) reasons.push("clinic_hours_missing");
  if (!nonEmpty(f.languages)) reasons.push("clinic_languages_missing");
  if (!nonEmpty(f.official_site_url) || !HTTPS.test(f.official_site_url ?? "")) {
    reasons.push("clinic_official_site_missing");
  }
  if (nonEmpty(f.booking_url) && !HTTPS.test(f.booking_url ?? "")) {
    reasons.push("clinic_booking_url_invalid");
  }
  if ((f.is_partner ?? "").toLowerCase() === "true" && !nonEmpty(f.partnership_disclosure)) {
    reasons.push("clinic_partnership_disclosure_missing");
  }
  if ((f.invented ?? "").toLowerCase() === "true") {
    reasons.push("invented_data_forbidden");
  }
  if (!nonEmpty(f.evidence_verified_at) && !row.lastVerifiedAt) {
    reasons.push("clinic_evidence_missing");
  }

  const prov = summarizeProvenanceCompleteness(
    row.provenance,
    CLINIC_REQUIRED_PROVENANCE_FIELDS,
  );
  if (!prov.complete) reasons.push("field_provenance_incomplete");

  const stale = evaluateStaleGroups({
    lane: "clinic_professional",
    lastVerifiedAt: row.lastVerifiedAt ?? f.evidence_verified_at ?? null,
    hasOfficialConfirmed: Boolean(
      nonEmpty(f.official_site_url) && HTTPS.test(f.official_site_url ?? ""),
    ),
    fieldGroupsPresent: [
      "evidence",
      "operating_status",
      ...((f.is_partner ?? "").toLowerCase() === "true" ? ["partnership"] : []),
    ],
  });
  if (stale.blockPublish || stale.staleFieldGroups.includes("evidence")) {
    reasons.push("clinic_evidence_stale");
    reasons.push("stale_beyond_refresh_window");
  }

  return [...new Set(reasons)];
}

function resolveEligibility(
  row: DryRunRowInput,
  reasons: RejectionReasonCode[],
): OnboardingEligibility {
  if (row.isFixture) return "fixture_non_public";
  if (isAccessModeBlocked(row.accessMode)) return "blocked_policy";

  const blocking = reasons.filter(
    (code) =>
      code !== "sale_page_unverified" &&
      code !== "duplicate_unresolved" &&
      code !== "professional_listing_incomplete",
  );
  // sale_page_unverified alone → needs_manual_review (not staging-ready for recommend)
  if (blocking.length > 0) return "rejected";
  if (reasons.includes("sale_page_unverified") || reasons.includes("duplicate_unresolved")) {
    return "needs_manual_review";
  }
  if (reasons.includes("professional_listing_incomplete")) return "needs_manual_review";
  return "eligible_for_staging_review";
}

/**
 * Validate one onboarding row in memory. Always publicVisible=false for dry-run.
 */
export function validateOnboardingRowDryRun(
  row: DryRunRowInput,
): DryRunValidationResult {
  const rejectionReasons =
    row.lane === "korean_product" ? productRejections(row) : clinicRejections(row);
  const checklistGaps =
    row.lane === "korean_product"
      ? evaluateProductChecklistGaps(row)
      : evaluateClinicChecklistGaps(row);

  const stale = evaluateStaleGroups({
    lane: row.lane,
    lastVerifiedAt:
      row.lastVerifiedAt ?? row.fields.evidence_verified_at ?? null,
    hasOfficialConfirmed:
      row.lane === "korean_product"
        ? Boolean(
            row.sourceKind &&
              isOfficialPrioritySource(row.sourceKind) &&
              nonEmpty(row.fields.official_source_url),
          )
        : Boolean(
            nonEmpty(row.fields.official_site_url) &&
              HTTPS.test(row.fields.official_site_url ?? ""),
          ),
    fieldGroupsPresent:
      row.lane === "korean_product"
        ? [
            "official_page",
            "full_inci",
            ...(nonEmpty(row.fields.sale_page_url) ? ["sale_offer"] : []),
          ]
        : [
            "evidence",
            "operating_status",
            ...((row.fields.is_partner ?? "").toLowerCase() === "true"
              ? ["partnership"]
              : []),
          ],
  });

  const eligibility = resolveEligibility(row, rejectionReasons);
  const readinessOk =
    eligibility === "eligible_for_staging_review" ||
    eligibility === "needs_manual_review" ||
    eligibility === "fixture_non_public";

  return {
    rowId: row.rowId,
    lane: row.lane,
    ok: readinessOk,
    eligibility,
    rejectionReasons,
    checklistGaps,
    staleFieldGroups: stale.staleFieldGroups,
    writeAttempted: false,
    productionWriteForbidden: true,
    publicVisible: false,
  };
}

/** Clearer ok semantics: structural dry-run succeeded without policy crash. */
export function isDryRunStructurallyOk(result: DryRunValidationResult): boolean {
  return (
    result.writeAttempted === false &&
    result.productionWriteForbidden === true &&
    result.publicVisible === false
  );
}

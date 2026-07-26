/**
 * Stage 6 — clinic field verification and publish gate.
 * Fake clinics must never become user-visible without admin_reviewed + publishable.
 */

import type { ClinicCandidate } from "@/lib/clinic/referralRankingPolicy";

export type ClinicVerificationStatus =
  | "discovered"
  | "source_checked"
  | "fields_verified"
  | "admin_reviewed"
  | "publishable"
  | "blocked"
  | "insufficient_data";

export type ClinicFieldRecord = ClinicCandidate & {
  verificationStatus: ClinicVerificationStatus;
  countryCode: string;
  city: string | null;
  address: string | null;
  operatingHours: string | null;
  languages: string[];
  consultationBudgetBand: "unknown" | "low" | "mid" | "high";
  medicalStaffNote: string | null;
  fixtureOnly: boolean;
  lastFieldCheckAt: string | null;
  fieldCheckReasons: string[];
};

export type ClinicFieldCheckResult = {
  ok: boolean;
  nextStatus: ClinicVerificationStatus;
  reasons: string[];
};

const HTTPS = /^https:\/\//i;

export function checkClinicFields(
  clinic: Pick<
    ClinicFieldRecord,
    | "name"
    | "specialties"
    | "symptomTags"
    | "evidence"
    | "officialSiteUrl"
    | "bookingUrl"
    | "address"
    | "operatingHours"
    | "languages"
    | "isPartner"
    | "partnershipType"
    | "partnershipDisclosure"
    | "fixtureOnly"
    | "verificationStatus"
  >,
): ClinicFieldCheckResult {
  const reasons: string[] = [];

  if (!clinic.name.trim()) reasons.push("clinic_name_missing");
  if (clinic.specialties.length === 0) reasons.push("specialties_missing");
  if (clinic.symptomTags.length === 0) reasons.push("symptom_tags_missing");
  if (clinic.evidence.length === 0) reasons.push("evidence_missing");
  if (!clinic.address?.trim()) reasons.push("address_missing");
  if (!clinic.operatingHours?.trim()) reasons.push("operating_hours_missing");
  if (clinic.languages.length === 0) reasons.push("languages_missing");
  if (!clinic.officialSiteUrl || !HTTPS.test(clinic.officialSiteUrl)) {
    reasons.push("official_site_invalid");
  }
  if (clinic.bookingUrl && !HTTPS.test(clinic.bookingUrl)) {
    reasons.push("booking_url_invalid");
  }
  if (clinic.isPartner && clinic.partnershipType === "none") {
    reasons.push("partnership_type_missing");
  }
  if (clinic.isPartner && !clinic.partnershipDisclosure?.trim()) {
    reasons.push("partnership_disclosure_missing");
  }
  if (clinic.fixtureOnly && clinic.verificationStatus === "publishable") {
    reasons.push("fixture_cannot_auto_publish");
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      nextStatus: "insufficient_data",
      reasons,
    };
  }

  return {
    ok: true,
    nextStatus: "fields_verified",
    reasons: ["fields_complete"],
  };
}

/** User-facing exposure requires admin_reviewed → publishable and never blocked. */
export function isClinicPublishable(clinic: ClinicFieldRecord): boolean {
  if (!clinic.isActive) return false;
  if (clinic.verificationStatus === "blocked") return false;
  if (clinic.verificationStatus !== "publishable") return false;
  if (clinic.fixtureOnly) return false;
  const check = checkClinicFields(clinic);
  return check.ok;
}

/** Admin may mark fields_verified → admin_reviewed → publishable (never auto). */
export function advanceClinicReviewStatus(
  clinic: ClinicFieldRecord,
  action: "mark_admin_reviewed" | "mark_publishable" | "block",
): { ok: boolean; clinic: ClinicFieldRecord; reasons: string[] } {
  if (action === "block") {
    return {
      ok: true,
      clinic: { ...clinic, verificationStatus: "blocked" },
      reasons: ["blocked_by_admin"],
    };
  }

  const check = checkClinicFields(clinic);
  if (!check.ok) {
    return {
      ok: false,
      clinic: {
        ...clinic,
        verificationStatus: "insufficient_data",
        fieldCheckReasons: check.reasons,
      },
      reasons: check.reasons,
    };
  }

  if (action === "mark_admin_reviewed") {
    if (clinic.fixtureOnly) {
      return {
        ok: false,
        clinic,
        reasons: ["fixture_review_only_dry_run"],
      };
    }
    return {
      ok: true,
      clinic: {
        ...clinic,
        verificationStatus: "admin_reviewed",
        fieldCheckReasons: check.reasons,
        lastFieldCheckAt: new Date().toISOString(),
      },
      reasons: ["admin_reviewed"],
    };
  }

  if (clinic.verificationStatus !== "admin_reviewed") {
    return {
      ok: false,
      clinic,
      reasons: ["admin_review_required_before_publishable"],
    };
  }
  if (clinic.fixtureOnly) {
    return {
      ok: false,
      clinic,
      reasons: ["fixture_cannot_publish"],
    };
  }

  return {
    ok: true,
    clinic: {
      ...clinic,
      verificationStatus: "publishable",
      fieldCheckReasons: check.reasons,
      lastFieldCheckAt: new Date().toISOString(),
    },
    reasons: ["marked_publishable"],
  };
}

export function toRankingCandidate(clinic: ClinicFieldRecord): ClinicCandidate {
  return {
    id: clinic.id,
    name: clinic.name,
    specialties: clinic.specialties,
    symptomTags: clinic.symptomTags,
    treatmentInfoTags: clinic.treatmentInfoTags,
    distanceKm: clinic.distanceKm,
    officialSiteUrl: clinic.officialSiteUrl,
    bookingUrl: clinic.bookingUrl,
    evidence: clinic.evidence,
    isPartner: clinic.isPartner,
    partnershipType: clinic.partnershipType,
    partnershipDisclosure: clinic.partnershipDisclosure,
    isActive: clinic.isActive,
    languages: clinic.languages,
    consultationBudgetBand: clinic.consultationBudgetBand,
  };
}

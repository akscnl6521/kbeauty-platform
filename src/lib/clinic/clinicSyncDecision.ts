import type { ClinicCandidate } from "@/lib/clinic/referralRankingPolicy";

export type ClinicSourceSnapshot = {
  sourceUrl: string;
  sourceType: "official_site" | "medical_directory" | "public_registry";
  fetchedAt: string;
  sourceHash: string;
  name: string;
  officialSiteUrl: string | null;
  bookingUrl: string | null;
  specialties: string[];
  symptomTags: string[];
  isActive: boolean | null;
  partnershipType: ClinicCandidate["partnershipType"];
  partnershipDisclosure: string | null;
};

export type ClinicSyncAction =
  | "insert_candidate"
  | "update_candidate"
  | "no_change"
  | "manual_review"
  | "block_listing";

export type ClinicSyncDecision = {
  action: ClinicSyncAction;
  reasonCodes: string[];
  publishAllowed: false;
  matchedClinicId: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function listKey(values: string[]): string {
  return [...new Set(values.map(norm).filter(Boolean))].sort().join("|");
}

function sameSnapshot(snapshot: ClinicSourceSnapshot, existing: ClinicCandidate): boolean {
  return (
    norm(snapshot.name) === norm(existing.name) &&
    norm(snapshot.officialSiteUrl) === norm(existing.officialSiteUrl) &&
    norm(snapshot.bookingUrl) === norm(existing.bookingUrl) &&
    listKey(snapshot.specialties) === listKey(existing.specialties) &&
    listKey(snapshot.symptomTags) === listKey(existing.symptomTags) &&
    snapshot.isActive === existing.isActive &&
    snapshot.partnershipType === existing.partnershipType &&
    norm(snapshot.partnershipDisclosure) === norm(existing.partnershipDisclosure)
  );
}

function findExactMatch(
  snapshot: ClinicSourceSnapshot,
  existing: ClinicCandidate[]
): ClinicCandidate | null {
  const sourceHost = (() => {
    try {
      return new URL(snapshot.officialSiteUrl ?? snapshot.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  return (
    existing.find((clinic) => {
      const sameName = norm(clinic.name) === norm(snapshot.name);
      let sameHost = false;
      try {
        sameHost = Boolean(
          sourceHost &&
            new URL(clinic.officialSiteUrl ?? "https://invalid.local").hostname.replace(/^www\./, "") === sourceHost
        );
      } catch {
        sameHost = false;
      }
      return sameName || sameHost;
    }) ?? null
  );
}

export function decideClinicSync(
  snapshot: ClinicSourceSnapshot,
  existing: ClinicCandidate[]
): ClinicSyncDecision {
  const reasons: string[] = [];

  if (!snapshot.sourceUrl.startsWith("https://")) reasons.push("source_not_https");
  if (!snapshot.name.trim()) reasons.push("clinic_name_missing");
  if (!snapshot.sourceHash.trim()) reasons.push("source_hash_missing");

  if (snapshot.isActive === false) {
    return {
      action: "block_listing",
      reasonCodes: [...reasons, "inactive_or_closed"],
      publishAllowed: false,
      matchedClinicId: findExactMatch(snapshot, existing)?.id ?? null,
    };
  }

  if (snapshot.isActive === null) reasons.push("operating_status_unconfirmed");
  if (snapshot.specialties.length === 0) reasons.push("specialties_missing");
  if (snapshot.symptomTags.length === 0) reasons.push("symptom_tags_missing");
  if (!snapshot.officialSiteUrl && snapshot.sourceType !== "public_registry") {
    reasons.push("official_source_unconfirmed");
  }
  if (
    snapshot.partnershipType !== "none" &&
    !snapshot.partnershipDisclosure?.trim()
  ) {
    reasons.push("partnership_disclosure_missing");
  }

  const match = findExactMatch(snapshot, existing);
  if (reasons.length > 0) {
    return {
      action: "manual_review",
      reasonCodes: reasons,
      publishAllowed: false,
      matchedClinicId: match?.id ?? null,
    };
  }

  if (!match) {
    return {
      action: "insert_candidate",
      reasonCodes: ["new_verified_candidate"],
      publishAllowed: false,
      matchedClinicId: null,
    };
  }

  if (sameSnapshot(snapshot, match)) {
    return {
      action: "no_change",
      reasonCodes: ["verified_fields_unchanged"],
      publishAllowed: false,
      matchedClinicId: match.id,
    };
  }

  return {
    action: "update_candidate",
    reasonCodes: ["verified_fields_changed"],
    publishAllowed: false,
    matchedClinicId: match.id,
  };
}

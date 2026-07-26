/**
 * Stage 6 — official clinic candidate collection adapters.
 * No CAPTCHA bypass, no paid APIs, no invented publishable clinics.
 */

import type { ClinicFieldRecord } from "@/lib/clinic/clinicVerification";
import { checkClinicFields } from "@/lib/clinic/clinicVerification";

export type ClinicSourceFailure =
  | "rate_limited"
  | "blocked"
  | "authentication_required"
  | "robots_restricted"
  | "captcha_required"
  | "timeout"
  | "connection_reset"
  | "invalid_response"
  | "source_changed"
  | "unavailable"
  | "parsing_failed"
  | "dry_run_only";

export type ClinicCollectionMode = "fixture" | "dry_run" | "live_blocked";

export type ClinicSourceAdapterId =
  | "fixture_seed"
  | "public_registry_dry_run"
  | "official_site_dry_run";

export type ClinicCollectionResult = {
  mode: ClinicCollectionMode;
  adapterId: ClinicSourceAdapterId;
  collectedAt: string;
  candidates: ClinicFieldRecord[];
  failures: Array<{
    adapterId: ClinicSourceAdapterId;
    sourceUrl: string | null;
    failure: ClinicSourceFailure;
    detail: string;
  }>;
  publishAllowed: false;
  databaseTouched: false;
  productionTouched: false;
};

export type ClinicSourceAdapter = {
  id: ClinicSourceAdapterId;
  mode: ClinicCollectionMode;
  collect(): Promise<ClinicCollectionResult>;
};

function baseCandidate(
  partial: Omit<ClinicFieldRecord, "fieldCheckReasons" | "lastFieldCheckAt"> & {
    fieldCheckReasons?: string[];
    lastFieldCheckAt?: string | null;
  },
): ClinicFieldRecord {
  const draft: ClinicFieldRecord = {
    ...partial,
    lastFieldCheckAt: partial.lastFieldCheckAt ?? null,
    fieldCheckReasons: partial.fieldCheckReasons ?? [],
  };
  const check = checkClinicFields(draft);
  return {
    ...draft,
    fieldCheckReasons: check.reasons,
    verificationStatus: check.ok
      ? draft.verificationStatus === "discovered"
        ? "source_checked"
        : draft.verificationStatus
      : draft.verificationStatus === "publishable" ||
          draft.verificationStatus === "admin_reviewed"
        ? draft.verificationStatus
        : "insufficient_data",
  };
}

/** Honest fixture seeds — fixtureOnly=true so they never auto-publish to users. */
export function buildFixtureClinicCandidates(
  nowIso = "2026-07-23T00:00:00.000Z",
): ClinicFieldRecord[] {
  return [
    baseCandidate({
      id: "fixture-organic-redness-seocho",
      name: "[FIXTURE] 서초 홍조 피부과 예시",
      specialties: ["피부과"],
      symptomTags: ["홍조", "민감성", "여드름"],
      treatmentInfoTags: ["장벽관리"],
      distanceKm: 4.2,
      officialSiteUrl: "https://fixture-clinic-organic.example/ko",
      bookingUrl: "https://fixture-clinic-organic.example/book",
      evidence: [
        {
          sourceUrl: "https://fixture-clinic-organic.example/ko/clinic",
          sourceType: "official_site",
          verifiedAt: nowIso,
        },
      ],
      isPartner: false,
      partnershipType: "none",
      partnershipDisclosure: null,
      isActive: true,
      verificationStatus: "fields_verified",
      countryCode: "KR",
      city: "서울",
      address: "서울특별시 서초구 (fixture)",
      operatingHours: "평일 10:00-19:00 (fixture)",
      languages: ["ko", "en"],
      consultationBudgetBand: "mid",
      medicalStaffNote: "의료진 실명은 fixture에 넣지 않음 — 검수 대기",
      fixtureOnly: true,
    }),
    baseCandidate({
      id: "fixture-partner-acne-gangnam",
      name: "[FIXTURE] 강남 제휴 여드름 의원 예시",
      specialties: ["피부과"],
      symptomTags: ["여드름", "민감성"],
      treatmentInfoTags: ["여드름관리"],
      distanceKm: 2.1,
      officialSiteUrl: "https://fixture-clinic-partner.example",
      bookingUrl: "https://fixture-clinic-partner.example/reserve",
      evidence: [
        {
          sourceUrl: "https://fixture-clinic-partner.example/about",
          sourceType: "official_site",
          verifiedAt: nowIso,
        },
      ],
      isPartner: true,
      partnershipType: "booking_fee",
      partnershipDisclosure:
        "예약이 완료되면 플랫폼이 수수료를 받을 수 있습니다. (fixture)",
      isActive: true,
      verificationStatus: "fields_verified",
      countryCode: "KR",
      city: "서울",
      address: "서울특별시 강남구 (fixture)",
      operatingHours: "평일 11:00-20:00 (fixture)",
      languages: ["ko"],
      consultationBudgetBand: "high",
      medicalStaffNote: null,
      fixtureOnly: true,
    }),
    baseCandidate({
      id: "fixture-incomplete-directory",
      name: "[FIXTURE] 정보 부족 디렉터리 후보",
      specialties: [],
      symptomTags: ["홍조"],
      treatmentInfoTags: [],
      distanceKm: null,
      officialSiteUrl: null,
      bookingUrl: null,
      evidence: [],
      isPartner: false,
      partnershipType: "none",
      partnershipDisclosure: null,
      isActive: true,
      verificationStatus: "discovered",
      countryCode: "KR",
      city: null,
      address: null,
      operatingHours: null,
      languages: [],
      consultationBudgetBand: "unknown",
      medicalStaffNote: null,
      fixtureOnly: true,
    }),
  ];
}

export const fixtureClinicAdapter: ClinicSourceAdapter = {
  id: "fixture_seed",
  mode: "fixture",
  async collect() {
    return {
      mode: "fixture",
      adapterId: "fixture_seed",
      collectedAt: new Date().toISOString(),
      candidates: buildFixtureClinicCandidates(),
      failures: [],
      publishAllowed: false,
      databaseTouched: false,
      productionTouched: false,
    };
  },
};

/** Live public-registry adapter is intentionally dry-run / blocked without approval. */
export const publicRegistryDryRunAdapter: ClinicSourceAdapter = {
  id: "public_registry_dry_run",
  mode: "dry_run",
  async collect() {
    return {
      mode: "dry_run",
      adapterId: "public_registry_dry_run",
      collectedAt: new Date().toISOString(),
      candidates: [],
      failures: [
        {
          adapterId: "public_registry_dry_run",
          sourceUrl: null,
          failure: "dry_run_only",
          detail:
            "공식 레지스트리 실수집은 승인·robots 확인 전까지 dry-run만 허용합니다.",
        },
      ],
      publishAllowed: false,
      databaseTouched: false,
      productionTouched: false,
    };
  },
};

export const officialSiteDryRunAdapter: ClinicSourceAdapter = {
  id: "official_site_dry_run",
  mode: "live_blocked",
  async collect() {
    return {
      mode: "live_blocked",
      adapterId: "official_site_dry_run",
      collectedAt: new Date().toISOString(),
      candidates: [],
      failures: [
        {
          adapterId: "official_site_dry_run",
          sourceUrl: null,
          failure: "authentication_required",
          detail:
            "공식 사이트 실크롤은 CAPTCHA/로그인 우회 금지 · 승인 전 live_blocked.",
        },
      ],
      publishAllowed: false,
      databaseTouched: false,
      productionTouched: false,
    };
  },
};

export async function runClinicCandidateCollection(
  adapters: ClinicSourceAdapter[] = [
    fixtureClinicAdapter,
    publicRegistryDryRunAdapter,
    officialSiteDryRunAdapter,
  ],
): Promise<ClinicCollectionResult> {
  const collectedAt = new Date().toISOString();
  const candidates: ClinicFieldRecord[] = [];
  const failures: ClinicCollectionResult["failures"] = [];
  let mode: ClinicCollectionMode = "dry_run";

  for (const adapter of adapters) {
    const result = await adapter.collect();
    candidates.push(...result.candidates);
    failures.push(...result.failures);
    if (adapter.mode === "fixture") mode = "fixture";
  }

  return {
    mode,
    adapterId: "fixture_seed",
    collectedAt,
    candidates,
    failures,
    publishAllowed: false,
    databaseTouched: false,
    productionTouched: false,
  };
}

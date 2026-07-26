/**
 * P3-T05 fixture upstream-like rows for dry-run bundling.
 * All rows are fixtures — never public / never import-executed.
 */

import type { UpstreamClinicLike, UpstreamProductLike } from "./mapRows";

export const FIXTURE_NOW_ISO = "2026-07-24T12:00:00.000Z";

export function createFixtureProductUpstream(): UpstreamProductLike[] {
  return [
    {
      sourceTaskId: "P3-T01",
      sourceRecordId: "okr-serum-001",
      displayName: "공식 KR 세럼 fixture (비공개)",
      isFixture: true,
      provenanceComplete: true,
      provenanceNotesKo: ["브랜드 공식·INCI provenance fixture"],
      refreshStatus: "fresh",
      commercialLane: "organic",
      adminApproved: false,
      hasOfficialEvidence: true,
    },
    {
      sourceTaskId: "P3-T02",
      sourceRecordId: "vpp-makeup-dup-a",
      displayName: "검증 풀 메이크업 중복 A",
      isFixture: true,
      provenanceComplete: true,
      isDuplicate: true,
      duplicateOf: "vpp-makeup-dup-b",
      refreshStatus: "fresh",
      commercialLane: "organic",
      rejectionCodes: ["duplicate_merged"],
    },
    {
      sourceTaskId: "P3-T02",
      sourceRecordId: "vpp-hair-stale-001",
      displayName: "검증 풀 헤어 stale fixture",
      isFixture: true,
      provenanceComplete: true,
      refreshStatus: "stale",
      commercialLane: "organic",
      hasOfficialEvidence: true,
      rejectionCodes: ["stale_beyond_window"],
    },
    {
      sourceTaskId: "P2-T04",
      sourceRecordId: "rdo-product-missing-inci",
      displayName: "온보딩 전성분 누락 fixture",
      isFixture: true,
      provenanceComplete: false,
      provenanceNotesKo: ["INCI provenance incomplete"],
      refreshStatus: "unknown",
      commercialLane: "none",
      rejected: true,
      rejectionCodes: ["full_inci_missing", "provenance_incomplete"],
      hasOfficialEvidence: false,
    },
    {
      sourceTaskId: "P3-T04",
      sourceRecordId: "aff-offer-fixture-001",
      displayName: "제휴 offer 준비 fixture (Organic 비오염)",
      isFixture: true,
      provenanceComplete: true,
      refreshStatus: "fresh",
      commercialLane: "affiliate",
      adminApproved: false,
      hasOfficialEvidence: true,
    },
  ];
}

export function createFixtureClinicUpstream(): UpstreamClinicLike[] {
  return [
    {
      sourceTaskId: "T07-05",
      sourceRecordId: "hira-seoul-derm-ready-001",
      displayName: "서울 피부과 구조적 후보 fixture",
      isFixture: true,
      provenanceComplete: true,
      provenanceNotesKo: ["HIRA·기관상세·증상근거 dry-run"],
      refreshStatus: "fresh",
      commercialLane: "organic",
      adminApproved: true,
      hasOfficialEvidence: true,
      structurallyPublishableUpstream: true,
    },
    {
      sourceTaskId: "T07-05",
      sourceRecordId: "hira-conflict-002",
      displayName: "기관상세 출처 충돌 fixture",
      isFixture: true,
      provenanceComplete: false,
      provenanceNotesKo: ["conflicting-source"],
      refreshStatus: "needs_refresh",
      commercialLane: "none",
      rejected: true,
      rejectionCodes: ["enrichment_conflicting_source"],
      hasOfficialEvidence: false,
    },
    {
      sourceTaskId: "T07-04",
      sourceRecordId: "symptom-evidence-pending-001",
      displayName: "증상 근거 검수 대기 fixture",
      isFixture: true,
      provenanceComplete: true,
      refreshStatus: "due",
      commercialLane: "organic",
      adminApproved: false,
      hasOfficialEvidence: false,
      rejectionCodes: ["symptom_evidence_unverified"],
    },
    {
      sourceTaskId: "P3-T03",
      sourceRecordId: "clinic-refresh-due-001",
      displayName: "병원 갱신 due fixture",
      isFixture: true,
      provenanceComplete: true,
      refreshStatus: "due",
      commercialLane: "sponsored",
      adminApproved: false,
      hasOfficialEvidence: true,
    },
  ];
}

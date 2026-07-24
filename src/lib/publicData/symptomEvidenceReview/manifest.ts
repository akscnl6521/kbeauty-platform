/**
 * Approved evidence source manifest — official hospital / approved public only.
 * Blocked modes never enter the review queue as publishable candidates.
 */

import type { SymptomEvidenceManifestEntry } from "./types";

export const SYMPTOM_EVIDENCE_SOURCE_MANIFEST: readonly SymptomEvidenceManifestEntry[] =
  [
    {
      sourceId: "official-hospital-page",
      kind: "official_hospital_page",
      displayNameKo: "공식 병원/의료기관 페이지",
      hostPattern: null,
      accessMode: "manifest_manual",
      allowedForReviewQueue: true,
      requiresHumanReview: true,
      notesKo:
        "병원 공식 사이트·진료안내 공개 페이지만. URL·제목·발췌를 관리자가 매니페스트에 입력.",
    },
    {
      sourceId: "approved-public-evidence",
      kind: "approved_public_evidence",
      displayNameKo: "승인된 공개 근거(학회·공공)",
      hostPattern: null,
      accessMode: "public_https_paste",
      allowedForReviewQueue: true,
      requiresHumanReview: true,
      notesKo:
        "사전 승인된 공공/학회 공개 자료. 유료 API·로그인 벽 자료 제외.",
    },
    {
      sourceId: "fixture-offline",
      kind: "fixture_offline",
      displayNameKo: "오프라인 fixture(비공개)",
      hostPattern: "fixture.local",
      accessMode: "offline_fixture",
      allowedForReviewQueue: true,
      requiresHumanReview: true,
      notesKo: "테스트 전용. 공개·게시 금지.",
    },
    {
      sourceId: "marketplace-blog-blocked",
      kind: "marketplace_or_blog",
      displayNameKo: "마켓/블로그(단독 불가)",
      hostPattern: null,
      accessMode: "manifest_manual",
      allowedForReviewQueue: false,
      requiresHumanReview: true,
      notesKo: "단독 증상 전문 근거로 사용 금지.",
    },
    {
      sourceId: "partner-feed-blocked",
      kind: "partner_feed",
      displayNameKo: "제휴 피드(차단)",
      hostPattern: null,
      accessMode: "blocked_paid_api",
      allowedForReviewQueue: false,
      requiresHumanReview: true,
      notesKo: "유료/제휴 피드로 증상 전문 주장 금지.",
    },
    {
      sourceId: "auth-wall-blocked",
      kind: "unknown",
      displayNameKo: "로그인 벽(차단)",
      hostPattern: null,
      accessMode: "blocked_auth_required",
      allowedForReviewQueue: false,
      requiresHumanReview: true,
      notesKo: "로그인 자동화 금지.",
    },
    {
      sourceId: "captcha-blocked",
      kind: "unknown",
      displayNameKo: "CAPTCHA(차단)",
      hostPattern: null,
      accessMode: "blocked_captcha",
      allowedForReviewQueue: false,
      requiresHumanReview: true,
      notesKo: "CAPTCHA 우회 금지.",
    },
    {
      sourceId: "restricted-crawl-blocked",
      kind: "unknown",
      displayNameKo: "제한 크롤(차단)",
      hostPattern: null,
      accessMode: "blocked_restricted_crawl",
      allowedForReviewQueue: false,
      requiresHumanReview: true,
      notesKo: "robots/약관상 제한 크롤 금지.",
    },
    {
      sourceId: "terms-scrape-blocked",
      kind: "unknown",
      displayNameKo: "약관 위험 스크래핑(차단)",
      hostPattern: null,
      accessMode: "blocked_terms_risk_scrape",
      allowedForReviewQueue: false,
      requiresHumanReview: true,
      notesKo: "약관 위험 스크래핑 금지.",
    },
  ] as const;

export function findManifestEntry(
  sourceId: string,
): SymptomEvidenceManifestEntry | undefined {
  return SYMPTOM_EVIDENCE_SOURCE_MANIFEST.find((e) => e.sourceId === sourceId);
}

export function isAllowedSourceKind(
  kind: SymptomEvidenceManifestEntry["kind"],
): boolean {
  return kind === "official_hospital_page" || kind === "approved_public_evidence";
}

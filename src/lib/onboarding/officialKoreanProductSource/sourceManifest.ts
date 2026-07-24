/**
 * Official-source-first manifest for Korean product onboarding (P3-T01).
 * Paid API / auth scrape / CAPTCHA / terms-risk automation are blocked.
 */

import { BLOCKED_ACCESS_MODES } from "./constants";
import type {
  OfficialProductSourceKind,
  OfficialSourceTier,
  SourceAccessMode,
  SourceManifestEntry,
} from "./types";

/** Tier 1 = highest trust. Marketplace/fixture never outrank official. */
export const SOURCE_TIER_PRIORITY: Record<
  OfficialProductSourceKind,
  OfficialSourceTier
> = {
  brand_official_page: 1,
  official_kr_mall_page: 1,
  official_inci_disclosure: 1,
  authorized_retailer_page: 2,
  manual_curated: 2,
  partner_feed: 3,
  marketplace_listing: 3,
  fixture_offline: 4,
};

export const CANONICAL_SOURCE_MANIFEST: readonly SourceManifestEntry[] = [
  {
    sourceId: "kr-brand-official",
    kind: "brand_official_page",
    displayNameKo: "브랜드 공식 사이트",
    hostPattern: "*.brand-official.example",
    tier: 1,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "공개 HTTPS 공식 페이지만. 로그인·CAPTCHA·약관 위험 자동화 금지.",
  },
  {
    sourceId: "kr-official-mall",
    kind: "official_kr_mall_page",
    displayNameKo: "공식 한국몰 제품 페이지",
    hostPattern: null,
    tier: 1,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "공식몰 가격·재고·배송국. 미확인 필드는 null 유지.",
  },
  {
    sourceId: "kr-official-inci",
    kind: "official_inci_disclosure",
    displayNameKo: "공식 전성분·라벨 공개",
    hostPattern: null,
    tier: 1,
    accessMode: "manual_paste",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "공식 INCI/라벨만. 미확인 시 추천 적격 금지.",
  },
  {
    sourceId: "kr-authorized-retailer",
    kind: "authorized_retailer_page",
    displayNameKo: "공식 인증 판매처",
    hostPattern: null,
    tier: 2,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "공식보다 우선하지 않음. 판매 확인 보조.",
  },
  {
    sourceId: "kr-marketplace",
    kind: "marketplace_listing",
    displayNameKo: "마켓플레이스 리스팅",
    hostPattern: null,
    tier: 3,
    accessMode: "public_https",
    allowedForImport: false,
    requiresHumanReview: true,
    notesKo: "단독 출처로 온보딩 불가. 공식 출처 보강 필요.",
  },
  {
    sourceId: "kr-paid-api-blocked",
    kind: "partner_feed",
    displayNameKo: "유료 API/피드(차단)",
    hostPattern: null,
    tier: 3,
    accessMode: "blocked_paid_api",
    allowedForImport: false,
    requiresHumanReview: true,
    notesKo: "유료 API 호출 금지.",
  },
  {
    sourceId: "kr-captcha-blocked",
    kind: "brand_official_page",
    displayNameKo: "CAPTCHA 필요 출처(차단)",
    hostPattern: null,
    tier: 1,
    accessMode: "blocked_captcha",
    allowedForImport: false,
    requiresHumanReview: true,
    notesKo: "CAPTCHA 우회 금지.",
  },
  {
    sourceId: "kr-auth-blocked",
    kind: "official_kr_mall_page",
    displayNameKo: "로그인 필요 출처(차단)",
    hostPattern: null,
    tier: 1,
    accessMode: "blocked_auth_required",
    allowedForImport: false,
    requiresHumanReview: true,
    notesKo: "인증 스크래핑 금지.",
  },
  {
    sourceId: "kr-terms-risk-blocked",
    kind: "marketplace_listing",
    displayNameKo: "약관 위험 자동화(차단)",
    hostPattern: null,
    tier: 3,
    accessMode: "blocked_terms_risk",
    allowedForImport: false,
    requiresHumanReview: true,
    notesKo: "약관 위반 위험이 있는 자동화 금지.",
  },
  {
    sourceId: "kr-fixture-offline",
    kind: "fixture_offline",
    displayNameKo: "오프라인 fixture(비공개)",
    hostPattern: "fixture.local",
    tier: 4,
    accessMode: "offline_fixture",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "테스트 전용. 공개·추천·게시 금지.",
  },
];

export function isBlockedAccessMode(mode: SourceAccessMode): boolean {
  return (BLOCKED_ACCESS_MODES as readonly string[]).includes(mode);
}

export function pickPreferredSourceKind(
  kinds: OfficialProductSourceKind[],
): OfficialProductSourceKind | null {
  if (kinds.length === 0) return null;
  return [...kinds].sort(
    (a, b) => SOURCE_TIER_PRIORITY[a] - SOURCE_TIER_PRIORITY[b],
  )[0];
}

export function assertSourceManifestIntegrity(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of CANONICAL_SOURCE_MANIFEST) {
    if (ids.has(entry.sourceId)) errors.push(`dup_source:${entry.sourceId}`);
    ids.add(entry.sourceId);
    if (entry.tier !== SOURCE_TIER_PRIORITY[entry.kind]) {
      // fixture/marketplace may intentionally differ; only flag brand tiers
      if (
        entry.kind === "brand_official_page" ||
        entry.kind === "official_kr_mall_page" ||
        entry.kind === "official_inci_disclosure"
      ) {
        if (entry.accessMode === "public_https" || entry.accessMode === "manual_paste") {
          if (entry.tier !== 1) {
            errors.push(`tier_mismatch:${entry.sourceId}`);
          }
        }
      }
    }
    if (isBlockedAccessMode(entry.accessMode) && entry.allowedForImport) {
      errors.push(`blocked_allowed:${entry.sourceId}`);
    }
  }
  if (CANONICAL_SOURCE_MANIFEST.length < 8) {
    errors.push("source_manifest_too_small");
  }
  return errors;
}

/**
 * Official source priority + allowed source manifests for safe onboarding.
 * Paid API / auth scrape / CAPTCHA bypass are blocked at the contract layer.
 */

import type {
  OfficialSourceTier,
  OnboardingLane,
  SourceAccessMode,
  SourceKind,
  SourceManifestEntry,
} from "./types";

/** Tier 1 = highest trust. Marketplace and fixtures never outrank official. */
export const SOURCE_TIER_PRIORITY: Record<SourceKind, OfficialSourceTier> = {
  official_brand_site: 1,
  official_product_page: 1,
  official_inci_label: 1,
  clinic_official_site: 1,
  medical_registry: 1,
  authorized_retailer: 2,
  manual_curated: 2,
  partner_feed: 3,
  marketplace_listing: 3,
  fixture_offline: 4,
};

export const BLOCKED_ACCESS_MODES: readonly SourceAccessMode[] = [
  "blocked_auth_required",
  "blocked_paid_api",
  "blocked_captcha",
] as const;

export const CANONICAL_SOURCE_MANIFEST: readonly SourceManifestEntry[] = [
  {
    sourceId: "kr-brand-official",
    lane: "korean_product",
    kind: "official_brand_site",
    displayNameKo: "한국 브랜드 공식 사이트",
    hostPattern: "*.brand-official.example",
    tier: 1,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "공개 HTTPS 공식 페이지만. 로그인·CAPTCHA 우회 금지.",
  },
  {
    sourceId: "kr-official-product-page",
    lane: "korean_product",
    kind: "official_product_page",
    displayNameKo: "공식 제품 상세",
    hostPattern: null,
    tier: 1,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "제품명·용량·전성분 확인용. 재고·가격 미발명.",
  },
  {
    sourceId: "kr-official-inci",
    lane: "korean_product",
    kind: "official_inci_label",
    displayNameKo: "공식 전성분/라벨",
    hostPattern: null,
    tier: 1,
    accessMode: "manual_paste",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "라벨/공식 INCI 수동 붙여넣기. 미확인 시 추천 적격 금지.",
  },
  {
    sourceId: "kr-authorized-retailer",
    lane: "korean_product",
    kind: "authorized_retailer",
    displayNameKo: "공식 인증 판매처",
    hostPattern: null,
    tier: 2,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "공식보다 우선하지 않음. 판매 확인만.",
  },
  {
    sourceId: "kr-marketplace",
    lane: "korean_product",
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
    lane: "korean_product",
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
    sourceId: "kr-fixture-offline",
    lane: "korean_product",
    kind: "fixture_offline",
    displayNameKo: "오프라인 fixture(비공개)",
    hostPattern: "fixture.local",
    tier: 4,
    accessMode: "offline_fixture",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "테스트 전용. 공개·추천·게시 금지.",
  },
  {
    sourceId: "clinic-official",
    lane: "clinic_professional",
    kind: "clinic_official_site",
    displayNameKo: "병원/클리닉 공식 사이트",
    hostPattern: null,
    tier: 1,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "진료과·주소·예약 URL 확인. 광고 문구만으로 전문 분야 확정 금지.",
  },
  {
    sourceId: "clinic-registry",
    lane: "clinic_professional",
    kind: "medical_registry",
    displayNameKo: "의료기관 공개 등록 정보",
    hostPattern: null,
    tier: 1,
    accessMode: "public_https",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "공개 레지스트리만. 유료·로그인 필수 소스 제외.",
  },
  {
    sourceId: "clinic-fixture",
    lane: "clinic_professional",
    kind: "fixture_offline",
    displayNameKo: "병원 fixture(비공개)",
    hostPattern: "fixture-clinic.example",
    tier: 4,
    accessMode: "offline_fixture",
    allowedForImport: true,
    requiresHumanReview: true,
    notesKo: "fixtureOnly. publishable 전환 금지.",
  },
] as const;

export function getSourceTier(kind: SourceKind): OfficialSourceTier {
  return SOURCE_TIER_PRIORITY[kind];
}

export function isAccessModeBlocked(mode: SourceAccessMode): boolean {
  return (BLOCKED_ACCESS_MODES as readonly string[]).includes(mode);
}

export function isOfficialPrioritySource(kind: SourceKind): boolean {
  return getSourceTier(kind) === 1;
}

/** Official (tier 1) always beats marketplace/partner/fixture when choosing provenance. */
export function compareSourcePriority(a: SourceKind, b: SourceKind): number {
  return getSourceTier(a) - getSourceTier(b);
}

export function pickPreferredSource(
  kinds: SourceKind[],
): SourceKind | null {
  if (kinds.length === 0) return null;
  return [...kinds].sort(compareSourcePriority)[0] ?? null;
}

export function listAllowedManifestEntries(
  lane?: OnboardingLane,
): SourceManifestEntry[] {
  return CANONICAL_SOURCE_MANIFEST.filter((entry) => {
    if (lane && entry.lane !== lane) return false;
    return entry.allowedForImport && !isAccessModeBlocked(entry.accessMode);
  });
}

export function findManifestByKind(
  lane: OnboardingLane,
  kind: SourceKind,
): SourceManifestEntry | null {
  return (
    CANONICAL_SOURCE_MANIFEST.find(
      (entry) => entry.lane === lane && entry.kind === kind,
    ) ?? null
  );
}

export function assertSourceManifestIntegrity(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of CANONICAL_SOURCE_MANIFEST) {
    if (ids.has(entry.sourceId)) {
      errors.push(`duplicate_sourceId:${entry.sourceId}`);
    }
    ids.add(entry.sourceId);
    if (entry.tier !== getSourceTier(entry.kind)) {
      errors.push(`tier_mismatch:${entry.sourceId}`);
    }
    if (isAccessModeBlocked(entry.accessMode) && entry.allowedForImport) {
      errors.push(`blocked_but_allowed:${entry.sourceId}`);
    }
  }
  return errors;
}

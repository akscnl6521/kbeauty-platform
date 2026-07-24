/**
 * Approved manifests + non-public dry-run records for P3-T02.
 * Never claim as live catalog or public Top 5.
 */

import type {
  ApprovedOfficialManifestEntry,
  VerifiedPoolRawRecord,
} from "./types";

export const APPROVED_OFFICIAL_MANIFEST: ApprovedOfficialManifestEntry[] = [
  {
    manifestId: "m-brand-official",
    approved: true,
    sourceKind: "brand_official_page",
    hostPattern: "brand-official.example",
    notesKo: "승인된 브랜드 공식 페이지 매니페스트",
  },
  {
    manifestId: "m-official-mall",
    approved: true,
    sourceKind: "official_kr_mall_page",
    hostPattern: "mall.official.example",
    notesKo: "승인된 공식 KR몰 매니페스트",
  },
  {
    manifestId: "m-inci",
    approved: true,
    sourceKind: "official_inci_disclosure",
    hostPattern: "brand-official.example",
    notesKo: "승인된 공식 INCI 공개 매니페스트",
  },
  {
    manifestId: "m-marketplace-blocked",
    approved: false,
    sourceKind: "marketplace_listing",
    hostPattern: "marketplace.example",
    notesKo: "마켓 단독 — 승인 거부",
  },
];

function completeBase(
  partial: Partial<VerifiedPoolRawRecord> &
    Pick<
      VerifiedPoolRawRecord,
      "recordId" | "categoryHint" | "productNameKo" | "brandName"
    >,
): VerifiedPoolRawRecord {
  return {
    manifestId: "m-brand-official",
    productNameEn: partial.productNameEn ?? null,
    volumeLabel: partial.volumeLabel ?? "30ml",
    fullIngredients:
      partial.fullIngredients ??
      "Water, Glycerin, Centella Asiatica Extract, Butylene Glycol",
    officialSourceUrl:
      partial.officialSourceUrl ??
      `https://brand-official.example/products/${partial.recordId}`,
    sourceKind: partial.sourceKind ?? "brand_official_page",
    sourceVerification: partial.sourceVerification ?? "verified_official",
    ingredientsVerification:
      partial.ingredientsVerification ?? "verified_full_inci",
    imageRights: partial.imageRights ?? "verified_official",
    offerVerification: partial.offerVerification ?? "verified_purchase",
    purchaseUrl:
      partial.purchaseUrl ??
      `https://mall.official.example/kr/${partial.recordId}`,
    shadeOrColor: partial.shadeOrColor ?? null,
    finish: partial.finish ?? null,
    scalpOrHairHint: partial.scalpOrHairHint ?? null,
    bodyAreaHint: partial.bodyAreaHint ?? null,
    eyeOrLipHint: partial.eyeOrLipHint ?? null,
    makeupFamily: partial.makeupFamily ?? null,
    isFixture: partial.isFixture ?? true,
    isDryRunRecord: partial.isDryRunRecord ?? true,
    safetyFlags: partial.safetyFlags ?? [],
    forceRejectCode: partial.forceRejectCode ?? null,
    ...partial,
  };
}

/** Offline dry-run pool covering all five expansion categories + reject cases. */
export function createVerifiedPoolFixtures(): VerifiedPoolRawRecord[] {
  const skincare = completeBase({
    recordId: "vp-skincare-serum",
    brandName: "Example Lab",
    productNameKo: "센텔라 세럼",
    productNameEn: "Centella Serum",
    categoryHint: "serum",
    volumeLabel: "30ml",
  });

  /** Duplicate of skincare (same brand+name+volume) from mall manifest. */
  const skincareDup = completeBase({
    recordId: "vp-skincare-serum-dup",
    manifestId: "m-official-mall",
    brandName: "Example Lab",
    productNameKo: "센텔라 세럼",
    productNameEn: "Centella Serum",
    categoryHint: "serum",
    volumeLabel: "30ml",
    sourceKind: "official_kr_mall_page",
    officialSourceUrl: "https://mall.official.example/kr/centella-serum-30ml",
  });

  const makeup = completeBase({
    recordId: "vp-makeup-cushion",
    brandName: "Glow Base",
    productNameKo: "커버 쿠션",
    categoryHint: "cushion",
    volumeLabel: "15g",
    makeupFamily: "cushion",
    shadeOrColor: "21 light",
    finish: "natural",
  });

  const hair = completeBase({
    recordId: "vp-hair-shampoo",
    brandName: "Scalp Care Co",
    productNameKo: "진정 샴푸",
    categoryHint: "shampoo",
    volumeLabel: "400ml",
    scalpOrHairHint: "sensitive scalp",
  });

  const body = completeBase({
    recordId: "vp-body-lotion",
    brandName: "Body Calm",
    productNameKo: "바디 로션",
    categoryHint: "body_lotion",
    volumeLabel: "250ml",
    bodyAreaHint: "body",
  });

  const lip = completeBase({
    recordId: "vp-lip-tint",
    brandName: "Lip Lab",
    productNameKo: "벨벳 틴트",
    categoryHint: "lip_tint",
    volumeLabel: "4g",
    eyeOrLipHint: "lip",
    finish: "matte",
    shadeOrColor: "rose",
  });

  const eye = completeBase({
    recordId: "vp-eye-mascara",
    brandName: "Lash Co",
    productNameKo: "컬 마스카라",
    categoryHint: "mascara",
    volumeLabel: "8g",
    eyeOrLipHint: "eye",
  });

  const missingSource = completeBase({
    recordId: "vp-missing-source",
    brandName: "Partial Co",
    productNameKo: "미검증 출처 크림",
    categoryHint: "cream",
    sourceVerification: "missing",
    officialSourceUrl: null,
  });

  const missingIngredients = completeBase({
    recordId: "vp-missing-inci",
    brandName: "Partial Co",
    productNameKo: "미검증 성분 크림",
    categoryHint: "cream",
    fullIngredients: null,
    ingredientsVerification: "missing",
  });

  const missingImageRights = completeBase({
    recordId: "vp-missing-image",
    brandName: "Partial Co",
    productNameKo: "이미지권리 미확인",
    categoryHint: "cream",
    imageRights: "unknown",
  });

  const missingOffer = completeBase({
    recordId: "vp-missing-offer",
    brandName: "Partial Co",
    productNameKo: "구매처 없음",
    categoryHint: "cream",
    offerVerification: "missing",
    purchaseUrl: null,
  });

  const marketplace = completeBase({
    recordId: "vp-marketplace",
    manifestId: "m-marketplace-blocked",
    brandName: "Market Only",
    productNameKo: "마켓 단독",
    categoryHint: "serum",
    sourceKind: "marketplace_listing",
    sourceVerification: "present_unverified",
  });

  const safetyHold = completeBase({
    recordId: "vp-safety-hold",
    brandName: "Caution Lab",
    productNameKo: "전문의용",
    categoryHint: "serum",
    safetyFlags: ["professional_only", "red_flag_symptom"],
  });

  const unsupported = completeBase({
    recordId: "vp-unsupported-nail",
    brandName: "Nail Co",
    productNameKo: "네일 컬러",
    categoryHint: "nail_polish",
  });

  const inventedOffer = completeBase({
    recordId: "vp-invented-offer",
    brandName: "Invent Co",
    productNameKo: "발명 가격",
    categoryHint: "serum",
    offerVerification: "invented_blocked",
    forceRejectCode: "invented_field_forbidden",
  });

  return [
    skincare,
    skincareDup,
    makeup,
    hair,
    body,
    lip,
    eye,
    missingSource,
    missingIngredients,
    missingImageRights,
    missingOffer,
    marketplace,
    safetyHold,
    unsupported,
    inventedOffer,
  ];
}

/**
 * Synthetic live-shaped clone for gate regression only.
 * Still offline data — never written as published catalog.
 */
export function asLiveGateProbe(
  raw: VerifiedPoolRawRecord,
): VerifiedPoolRawRecord {
  return {
    ...raw,
    recordId: `${raw.recordId}-live-probe`,
    isFixture: false,
    isDryRunRecord: false,
  };
}

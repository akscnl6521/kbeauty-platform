/**
 * 이미 저장된 공식 검증 메타데이터 기반 표시 오버라이드.
 * DB UPDATE 없음 · 추정 금지 · 문서화된 공식 출처만.
 *
 * 출처: data/catalog/kr/cosrx-products.json `_meta.verifiedOfficialNames`
 * (COSRX 한국 공식몰 product URL + list price 확인)
 */

import { parseSizeFromProductName } from "@/lib/recommend/displayProductMeta";

export type VerifiedDisplayOverride = {
  sizeLabel: string;
  officialNameEn: string;
  sourceUrl: string;
  listPriceKrw: number;
};

/** product id → 검증된 표시 메타 (표시 전용) */
export const VERIFIED_DISPLAY_BY_PRODUCT_ID: Record<
  string,
  VerifiedDisplayOverride
> = {
  "4": {
    sizeLabel: "100 ml",
    officialNameEn: "Advanced Snail 96 Mucin Power Essence",
    sourceUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    listPriceKrw: 23000,
  },
  "28": {
    sizeLabel: "100 g",
    officialNameEn: "Advanced Snail 92 All in One Cream",
    sourceUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
    listPriceKrw: 23000,
  },
};

export function getVerifiedDisplayOverride(
  productId: string | number | null | undefined
): VerifiedDisplayOverride | null {
  if (productId == null) return null;
  return VERIFIED_DISPLAY_BY_PRODUCT_ID[String(productId)] ?? null;
}

/** 용량: 이름 파싱 우선, 없으면 검증 오버라이드 */
export function resolveDisplaySizeLabel(options: {
  productId?: string | number | null;
  name?: string | null;
  nameKo?: string | null;
}): string | null {
  const fromName =
    parseSizeFromProductName(options.nameKo)?.label ??
    parseSizeFromProductName(options.name)?.label ??
    null;
  if (fromName) return fromName;
  return getVerifiedDisplayOverride(options.productId)?.sizeLabel ?? null;
}

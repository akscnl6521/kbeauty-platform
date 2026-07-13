/**
 * 제품 메타 표시 정규화 (용량·제형·신뢰 상태).
 * DB/offer 검증 조건·점수와 무관 — 화면 표시만.
 */

export type ProductDisplayLocale = "en" | "ja" | "ko";

export type ParsedProductSize = {
  value: number;
  unit: "ml" | "g" | "sheets";
  label: string;
};

export type ProductTrustStatus =
  | "verified_product_and_offer"
  | "verified_product_no_offer"
  | "unverified_product"
  | "pending_review";

const SIZE_TRAILING_RE =
  /[\s\-–—]*(?:(\d+(?:\.\d+)?)\s*(ml|mL|ML|g|G|매|sheets?))\s*$/i;

/** 표시용 용량 라벨 정규화: `100ml` → `100 ml` */
export function formatProductSizeLabel(
  value: number | string | null | undefined,
  unit?: string | null
): string | null {
  if (value == null && !unit) return null;
  if (typeof value === "string" && !unit) {
    const parsed = parseSizeFromProductName(value);
    return parsed?.label ?? null;
  }
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = normalizeSizeUnit(unit ?? "");
  if (!u) return null;
  return `${n} ${u === "sheets" ? "sheets" : u}`;
}

export function normalizeSizeUnit(
  raw: string
): "ml" | "g" | "sheets" | null {
  const t = raw.trim().toLowerCase();
  if (t === "ml" || t === "milliliter" || t === "millilitre") return "ml";
  if (t === "g" || t === "gram" || t === "grams") return "g";
  if (t === "매" || t === "sheet" || t === "sheets" || t === "ea") {
    return "sheets";
  }
  return null;
}

/** 제품명 끝의 용량 표기를 파싱 (표시용). 농도(96% 등)는 용량이 아님. */
export function parseSizeFromProductName(
  name: string | null | undefined
): ParsedProductSize | null {
  const raw = String(name ?? "").trim();
  if (!raw) return null;
  const m = raw.match(SIZE_TRAILING_RE);
  if (!m?.[1] || !m[2]) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const token = m[2].toLowerCase();
  const unit =
    token === "매" || token.startsWith("sheet")
      ? "sheets"
      : token === "g"
        ? "g"
        : "ml";
  const label =
    unit === "sheets" ? `${value} sheets` : `${value} ${unit}`;
  return { value, unit, label };
}

/** 표시용: 제품명에서 끝 용량만 제거 (농도·본문은 유지) */
export function stripTrailingSizeFromProductName(
  name: string | null | undefined
): string {
  const raw = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw.replace(SIZE_TRAILING_RE, "").replace(/\s+/g, " ").trim();
}

const FORM_LABELS_KO: Record<string, string> = {
  essence: "에센스",
  cream: "크림",
  serum: "세럼",
  toner: "토너",
  cleanser: "클렌저",
  lotion: "로션",
  ampoule: "앰플",
  mask: "마스크",
  sunscreen: "선크림",
  toner_pad: "토너 패드",
};

/** category/form 필드가 있을 때만 제형 라벨 (제품명 임의 분해 금지) */
export function displayProductFormLabel(
  formOrCategory: string | null | undefined,
  locale: ProductDisplayLocale = "ko"
): string | null {
  const raw = String(formOrCategory ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  if (locale === "ko" && FORM_LABELS_KO[key]) return FORM_LABELS_KO[key];
  return raw;
}

export type ProductTrustInput = {
  productVerifiedAt?: string | null;
  hasVerifiedOffer?: boolean;
  dataConfidence?: string | null;
  productStatus?: string | null;
};

export function getProductTrustStatus(
  input: ProductTrustInput
): ProductTrustStatus {
  const hasProductVerified = Boolean(
    input.productVerifiedAt && String(input.productVerifiedAt).trim()
  );
  if (hasProductVerified && input.hasVerifiedOffer) {
    return "verified_product_and_offer";
  }
  if (hasProductVerified && !input.hasVerifiedOffer) {
    return "verified_product_no_offer";
  }
  if (
    input.productStatus === "draft" ||
    input.productStatus === "sample" ||
    input.dataConfidence === "unverified"
  ) {
    return "pending_review";
  }
  return "unverified_product";
}

export function productTrustStatusLabel(
  status: ProductTrustStatus,
  locale: ProductDisplayLocale = "ko"
): string {
  if (locale === "ko") {
    switch (status) {
      case "verified_product_and_offer":
        return "검증된 판매처";
      case "verified_product_no_offer":
        return "현재 확인된 판매처가 없습니다.";
      case "pending_review":
        return "검토 대기";
      default:
        return "판매처 미확인";
    }
  }
  if (locale === "ja") {
    switch (status) {
      case "verified_product_and_offer":
        return "確認済み販売先";
      case "verified_product_no_offer":
        return "確認済みの販売先がありません。";
      case "pending_review":
        return "審査待ち";
      default:
        return "販売先未確認";
    }
  }
  switch (status) {
    case "verified_product_and_offer":
      return "Verified retailer";
    case "verified_product_no_offer":
      return "No verified retailer available.";
    case "pending_review":
      return "Pending review";
    default:
      return "Retailer unverified";
  }
}

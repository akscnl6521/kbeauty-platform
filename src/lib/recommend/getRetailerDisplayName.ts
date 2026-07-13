/**
 * 판매처명 표시용 (DB retailer_name 은 변경하지 않음).
 */

export type RetailerDisplayLocale = "en" | "ja" | "ko";

export type GetRetailerDisplayNameInput = {
  retailerName: string;
  retailerCountry?: string | null;
  isOfficial?: boolean | null;
  locale?: RetailerDisplayLocale;
};

/**
 * UI 표시용 판매처명.
 * - ko + official + KR: "{브랜드} 한국 공식몰"
 * - en/ja: 원문 유지 (알려진 번역 없으면 원문)
 * - 일반 판매처: 상호 원문 유지
 */
export function getRetailerDisplayName(
  input: GetRetailerDisplayNameInput
): string {
  const name = (input.retailerName ?? "").trim();
  if (!name) return "";

  const locale = input.locale ?? "en";
  const country = (input.retailerCountry ?? "").trim().toUpperCase();
  const isOfficial = input.isOfficial === true;

  if (locale === "ko" && isOfficial && country === "KR") {
    const brandMatch = name.match(
      /^(.+?)\s+Official(?:\s+KR|\s+Korea)?$/i
    );
    if (brandMatch?.[1]) {
      return `${brandMatch[1].trim()} 한국 공식몰`;
    }
    // "COSRX Official KR" 등 이미 매칭된 경우 외: Official 토큰 제거 후 붙이기
    if (/official/i.test(name)) {
      const brand = name
        .replace(/\s*Official(?:\s+KR|\s+Korea)?\s*$/i, "")
        .trim();
      if (brand) return `${brand} 한국 공식몰`;
    }
  }

  // 정확 매핑 (official 플래그 누락 대비 — 표시만, DB 불변)
  if (locale === "ko") {
    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (
      key === "cosrx official kr" ||
      key === "cosrx official korea" ||
      key === "cosrx 공식몰" ||
      key === "cosrx 한국 공식몰"
    ) {
      return "COSRX 한국 공식몰";
    }
  }

  return name;
}

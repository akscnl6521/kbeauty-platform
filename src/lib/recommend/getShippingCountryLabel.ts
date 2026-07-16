/**
 * 배송 국가 버튼 표시 label (내부 code KR/US/JP 불변).
 */

export type ShippingCountryCode = "KR" | "US" | "JP";
export type ShippingCountryLocale = "en" | "ja" | "ko";

export function getShippingCountryLabel(
  code: ShippingCountryCode,
  locale: ShippingCountryLocale = "en"
): string {
  if (locale === "ko") {
    if (code === "KR") return "한국";
    if (code === "US") return "미국";
    if (code === "JP") return "일본";
  }
  if (locale === "ja") {
    if (code === "KR") return "韓国";
    if (code === "US") return "アメリカ";
    if (code === "JP") return "日本";
  }
  return code;
}

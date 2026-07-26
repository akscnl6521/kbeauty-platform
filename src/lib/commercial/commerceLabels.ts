/**
 * User-facing lane labels for Organic / Affiliate / Sponsored / partner clinic.
 */

export type CommerceLaneLabelKey =
  | "organic"
  | "affiliate"
  | "sponsored"
  | "partner_clinic"
  | "demo_fixture";

export const COMMERCE_LANE_LABELS_KO: Record<CommerceLaneLabelKey, string> = {
  organic: "Organic 추천",
  affiliate: "제휴 구매 링크",
  sponsored: "유료 광고",
  partner_clinic: "제휴 의료기관",
  demo_fixture: "fixture 미리보기 (비게시)",
};

export const COMMERCE_LANE_HINTS_KO: Record<CommerceLaneLabelKey, string> = {
  organic:
    "적합도 점수만으로 정렬됩니다. 광고비·수수료·캠페인은 순위에 영향을 주지 않습니다.",
  affiliate:
    "이 링크를 통한 구매가 발생하면 플랫폼이 수수료를 받을 수 있습니다. Organic 순위와 분리됩니다.",
  sponsored: "유료 광고 영역입니다. Organic 추천 이유로 표시되지 않습니다.",
  partner_clinic:
    "제휴·예약 수수료 의료기관입니다. Organic 병원 안내와 분리됩니다.",
  demo_fixture:
    "실제 게시 병원이 아닌 fixture입니다. 핵심 추천에 사용하지 않습니다.",
};

export function commerceLaneLabel(
  key: CommerceLaneLabelKey,
  locale: "ko" | "en" = "ko",
): string {
  if (locale === "en") {
    const en: Record<CommerceLaneLabelKey, string> = {
      organic: "Organic recommendation",
      affiliate: "Affiliate purchase link",
      sponsored: "Sponsored placement",
      partner_clinic: "Partnered clinic",
      demo_fixture: "Fixture preview (not published)",
    };
    return en[key];
  }
  return COMMERCE_LANE_LABELS_KO[key];
}

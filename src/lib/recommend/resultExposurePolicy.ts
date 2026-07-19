import type { ManagementLevel } from "./types";

export type ResultProductExposure =
  | "normal"
  | "supportive_reference_only"
  | "hidden";

export type ResultExposurePolicy = {
  productExposure: ResultProductExposure;
  showPurchaseCta: boolean;
  showPriceAndRetailer: boolean;
  allowCatalogBrowse: boolean;
  messageKo: string;
};

/**
 * 관리 단계에 따라 결과 화면의 상업적 제품 노출 범위를 결정한다.
 * 위험도가 높을수록 제품 판매보다 상태 확인을 우선한다.
 */
export function getResultExposurePolicy(
  level: ManagementLevel | undefined
): ResultExposurePolicy {
  if (level === "urgent_check") {
    return {
      productExposure: "hidden",
      showPurchaseCta: false,
      showPriceAndRetailer: false,
      allowCatalogBrowse: false,
      messageKo:
        "현재 입력에는 신속한 확인이 필요한 신호가 있어 제품 추천과 구매 정보를 표시하지 않습니다.",
    };
  }

  if (level === "expert_first") {
    return {
      productExposure: "supportive_reference_only",
      showPurchaseCta: false,
      showPriceAndRetailer: false,
      allowCatalogBrowse: false,
      messageKo:
        "현재는 제품 구매보다 전문가 상담이 우선입니다. 필요한 경우에만 자극을 줄이는 보조 관리 정보를 참고하세요.",
    };
  }

  return {
    productExposure: "normal",
    showPurchaseCta: true,
    showPriceAndRetailer: true,
    allowCatalogBrowse: true,
    messageKo: "검증된 제품과 구매 정보를 확인할 수 있습니다.",
  };
}

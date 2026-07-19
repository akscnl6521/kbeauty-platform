export type GuidanceManagementLevel =
  | "cosmetic_care"
  | "observe"
  | "combined_care"
  | "expert_first"
  | "urgent_check";

export type CareGuidanceViewModel = {
  managementLevel: GuidanceManagementLevel;
  managementLabel: string;
  concerns: string[];
  showProductUsage: boolean;
  showPurchaseLinks: boolean;
  clinicMode: "none" | "supportive" | "priority" | "urgent";
  clinicTitle: string;
  clinicMessage: string;
  safetySteps: string[];
  commercialDisclosure: string;
};

const MANAGEMENT_LABELS: Record<GuidanceManagementLevel, string> = {
  cosmetic_care: "화장품 중심 관리 가능",
  observe: "사용 후 경과 관찰",
  combined_care: "화장품 관리와 전문가 상담 병행",
  expert_first: "전문가 상담 우선",
  urgent_check: "신속한 의료기관 확인 권장",
};

function asManagementLevel(value: unknown): GuidanceManagementLevel {
  if (
    value === "cosmetic_care" ||
    value === "observe" ||
    value === "combined_care" ||
    value === "expert_first" ||
    value === "urgent_check"
  ) {
    return value;
  }
  return "observe";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

export function buildCareGuidanceViewModel(
  recommendation: Record<string, unknown> | null | undefined
): CareGuidanceViewModel {
  const managementLevel = asManagementLevel(recommendation?.managementLevel);
  const concerns = stringList(recommendation?.skinConcerns);

  if (managementLevel === "urgent_check") {
    return {
      managementLevel,
      managementLabel: MANAGEMENT_LABELS[managementLevel],
      concerns,
      showProductUsage: false,
      showPurchaseLinks: false,
      clinicMode: "urgent",
      clinicTitle: "제품보다 신속한 의료기관 확인이 우선입니다",
      clinicMessage:
        "호흡 곤란, 전신 알레르기, 급격한 붓기처럼 위급한 증상이 있다면 제품 사용을 중단하고 지역 응급서비스나 의료기관에 즉시 문의하세요.",
      safetySteps: [
        "새 제품과 활성 성분 사용을 중단하세요.",
        "사용한 제품명과 증상 발생 시간을 기록하세요.",
        "호흡 곤란·전신 반응·급격한 붓기는 즉시 지역 응급서비스에 문의하세요.",
      ],
      commercialDisclosure:
        "긴급 단계에서는 제품 구매 링크, 제휴 상품, 스폰서 병원 노출을 제공하지 않습니다.",
    };
  }

  if (managementLevel === "expert_first") {
    return {
      managementLevel,
      managementLabel: MANAGEMENT_LABELS[managementLevel],
      concerns,
      showProductUsage: true,
      showPurchaseLinks: false,
      clinicMode: "priority",
      clinicTitle: "전문가 상담을 먼저 권장합니다",
      clinicMessage:
        "증상과 진료 분야가 맞고 공식 근거가 확인된 피부과 정보를 우선 참고하세요. 제휴 여부는 추천 순위에 반영하지 않습니다.",
      safetySteps: [
        "부드러운 세안과 기본 보습만 유지하세요.",
        "강한 각질 제거와 고함량 활성 성분 추가를 미루세요.",
        "상담 시 체크인 기록과 사용 제품 목록을 함께 보여주세요.",
      ],
      commercialDisclosure:
        "제휴 피부과와 예약 수수료는 별도로 표시하며 Organic 추천 순위에는 영향을 주지 않습니다.",
    };
  }

  const combined = managementLevel === "combined_care";
  return {
    managementLevel,
    managementLabel: MANAGEMENT_LABELS[managementLevel],
    concerns,
    showProductUsage: true,
    showPurchaseLinks: true,
    clinicMode: combined ? "supportive" : "none",
    clinicTitle: combined
      ? "화장품 관리와 전문가 상담을 병행할 수 있습니다"
      : "현재는 경과를 관찰하며 관리할 수 있습니다",
    clinicMessage: combined
      ? "지속되거나 악화되는 증상은 증상 분야가 확인된 피부과 정보를 참고하세요."
      : "통증, 진물, 출혈, 급격한 붓기 또는 퍼지는 발진이 생기면 다음 체크인까지 기다리지 말고 전문가에게 확인하세요.",
    safetySteps: [
      "새 제품은 한 번에 하나씩 추가하세요.",
      "소량으로 시작하고 자극 여부를 기록하세요.",
      "Day 3·7·15·30 체크인으로 변화를 비교하세요.",
    ],
    commercialDisclosure:
      "제휴 구매 링크는 수수료가 발생할 수 있으나 Organic 제품 순위와 적합도 점수는 변경하지 않습니다.",
  };
}

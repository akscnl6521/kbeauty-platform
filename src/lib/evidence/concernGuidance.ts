/**
 * 고민별 주의 조건·회피 힌트 (추천/결과 UI용).
 * 의료 진단이 아니며, manufacturer claim이 아님.
 */
import { toCanonicalConcern } from "@/lib/recommend/concernAliases";

export type ConcernGuidance = {
  code: string;
  precautions: string[];
  /** 표시·필터용 성분 라벨 (과잉 억제용; 알레르기와 별개) */
  cautionIngredients: string[];
};

const BY_CODE: Record<string, ConcernGuidance> = {
  redness: {
    code: "redness",
    precautions: [
      "강한 향·고함량 알코올·과도한 각질 제거는 붉은기를 악화할 수 있음",
      "새 제품은 한 번에 하나만 도입",
    ],
    cautionIngredients: ["강한 레티노이드", "고농도 AHA/BHA"],
  },
  dryness: {
    code: "dryness",
    precautions: [
      "세안 직후 보습 누락·과도한 뜨거운 물은 건조를 심화할 수 있음",
      "활성 성분과 보습을 같은 루틴에서 균형을 맞출 것",
    ],
    cautionIngredients: ["고함량 변성 알코올"],
  },
  sensitivity: {
    code: "sensitivity",
    precautions: [
      "자극 활성(레티노이드·강산)은 민감도 안정 후 단계 도입",
      "패치 테스트 권장 · 동시에 여러 활성 중복 사용 자제",
    ],
    cautionIngredients: ["Retinol", "Salicylic Acid", "고함량 비타민 C"],
  },
  acne: {
    code: "acne",
    precautions: [
      "각질·피지 관리는 과하게 하지 말고 장벽 보습과 병행",
      "임신·수유·피부과 치료 중이면 전문가 상담 우선",
    ],
    cautionIngredients: ["고농도 레티노이드 중복", "다중 산(AHA+BHA) 중복"],
  },
  pigmentation: {
    code: "pigmentation",
    precautions: [
      "브라이트닝 성분은 낮 자외선 차단과 함께 사용",
      "고함량 순수 비타민 C·강산은 민감 시 자극 가능",
    ],
    cautionIngredients: ["고함량 순수 비타민 C", "하이드로퀴논(전문가용)"],
  },
  antiaging: {
    code: "antiaging",
    precautions: [
      "레티노이드·레티놀은 저녁 소량 시작 · 낮 자외선 차단 필수",
      "건조·홍반이 생기면 빈도 줄이고 보습을 강화",
    ],
    cautionIngredients: ["고농도 Retinol 중복", "주간 레티놀 사용"],
  },
  pores: {
    code: "pores",
    precautions: [
      "모공 관리는 과도한 탈지·강산 연용을 피할 것",
      "피지·각질 관리 후 반드시 보습으로 마무리",
    ],
    cautionIngredients: ["다중 AHA/BHA 중복", "강한 클렌징 연용"],
  },
  uv: {
    code: "uv",
    precautions: [
      "외출 시 광범위 SPF를 충분량·재도포 (보조 성분만으로 대체가 아님)",
      "광노화·색소 예방의 핵심은 자외선 차단제",
    ],
    cautionIngredients: ["자외선 차단 생략"],
  },
};

const LABEL_HINTS: Array<{ re: RegExp; code: string }> = [
  { re: /붉|홍조|red/i, code: "redness" },
  { re: /건|dry|dehydr/i, code: "dryness" },
  { re: /민감|sensitive|irrit/i, code: "sensitivity" },
  { re: /여드름|acne|트러블|breakout/i, code: "acne" },
  { re: /색소|기미|잡티|pigment|멜라닌|칙칙|Dull/i, code: "pigmentation" },
  { re: /주름|노화|anti.?aging|wrinkle|탄력/i, code: "antiaging" },
  { re: /모공|pore/i, code: "pores" },
  { re: /자외선|uv|sunscreen|spf|선크림/i, code: "uv" },
];

export function resolveGuidanceCodes(concernLabels: string[]): string[] {
  const codes = new Set<string>();
  for (const label of concernLabels) {
    const canon = toCanonicalConcern(label);
    if (canon && BY_CODE[canon]) codes.add(canon);
    for (const { re, code } of LABEL_HINTS) {
      if (re.test(label)) codes.add(code);
    }
    const lower = label.trim().toLowerCase();
    if (BY_CODE[lower]) codes.add(lower);
  }
  return [...codes];
}

export function guidanceForConcernLabels(
  concernLabels: string[]
): ConcernGuidance[] {
  return resolveGuidanceCodes(concernLabels)
    .map((c) => BY_CODE[c])
    .filter(Boolean);
}

export function mergeConcernGuidanceIntoLists(options: {
  concernLabels: string[];
  precautions?: string[] | null;
  ingredientsToAvoid?: string[] | null;
}): { precautions: string[]; cautionIngredients: string[] } {
  const guides = guidanceForConcernLabels(options.concernLabels);
  const precautions: string[] = [];
  const cautionIngredients: string[] = [];
  const seenP = new Set<string>();
  const seenC = new Set<string>();

  for (const raw of options.precautions ?? []) {
    const t = raw.trim();
    if (!t || seenP.has(t)) continue;
    seenP.add(t);
    precautions.push(t);
  }
  for (const g of guides) {
    for (const p of g.precautions) {
      if (seenP.has(p)) continue;
      seenP.add(p);
      precautions.push(p);
    }
    for (const c of g.cautionIngredients) {
      if (seenC.has(c)) continue;
      seenC.add(c);
      cautionIngredients.push(c);
    }
  }
  for (const raw of options.ingredientsToAvoid ?? []) {
    const t = raw.trim();
    if (!t || seenC.has(t)) continue;
    seenC.add(t);
    cautionIngredients.push(t);
  }
  return { precautions, cautionIngredients };
}

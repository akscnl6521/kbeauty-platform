/**
 * 분석 전 규칙형 참고 미리보기.
 * API 호출·rankProducts·offer·managementLevel 확정과 무관.
 * AI 확정 AnalysisResult 와 상태를 섞지 말 것.
 */

import { displayIngredientNames } from "@/lib/recommend/displayIngredientName";
import {
  hasRednessObservation,
  isRednessCounselingPriority,
  type RednessObservation,
} from "./rednessObservation";

/** A. 현재 폼 입력 */
export interface CurrentAnalyzeInput {
  skinTone: string;
  undertone: string;
  concerns: string[];
  sensitivity: string;
  rednessObservation?: RednessObservation;
}

/** B. 규칙형 참고 미리보기 */
export type AnalyzeReferencePreview = {
  kind: "reference_preview";
  skin_type: string;
  concerns: string[];
  ingredients: string[];
  cautionIngredients: string[];
  avoidHints: string[];
  summary_ko: string;
  toneNote_ko: string;
  morning_tips: string[];
  evening_tips: string[];
  counselingNote_ko: string | null;
};

type ConcernKey =
  | "붉은기"
  | "건조함"
  | "여드름"
  | "색소침착"
  | "주름"
  | "모공"
  | "자외선"
  | "칙칙함"
  | "노화방지";

/** 표시용 EN 원문 — displayIngredientNames로 KO 통일·canonical dedupe */
const CONCERN_INGREDIENTS: Record<ConcernKey, readonly string[]> = {
  건조함: [
    "Hyaluronic Acid",
    "Ceramide",
    "Panthenol",
    "Glycerin",
  ],
  붉은기: [
    "Centella Asiatica (Cica)",
    "Panthenol",
    "Ceramide",
    "Allantoin",
  ],
  여드름: [
    "Niacinamide",
    "Salicylic Acid",
    "Centella Asiatica (Cica)",
    "Panthenol",
  ],
  색소침착: [
    "Niacinamide",
    "Ascorbic Acid",
    "Vitamin C Derivative",
    "Alpha Arbutin",
  ],
  주름: ["Retinol", "Adenosine", "Peptide", "Ceramide"],
  모공: ["Niacinamide", "Salicylic Acid", "Zinc PCA", "Panthenol"],
  자외선: ["Zinc Oxide", "Ascorbic Acid", "Niacinamide", "Panthenol"],
  칙칙함: [
    "Niacinamide",
    "Vitamin C Derivative",
    "Alpha Arbutin",
  ],
  노화방지: ["Peptide", "Adenosine", "Retinoid", "Ceramide"],
};

const MAX_INGREDIENTS = 6;

const SALICYLIC = "Salicylic Acid";
const RETINOID = "Retinoid";
const RETINOL = "Retinol";

type RoutineStep = { key: string; label: string };

function isHighSensitivity(sensitivity: string): boolean {
  return sensitivity.trim() === "민감함";
}

function isLowSensitivity(sensitivity: string): boolean {
  return sensitivity.trim() === "강한편";
}

function buildSensitivityAvoidHints(sensitivity: string): string[] {
  if (isHighSensitivity(sensitivity)) {
    return [
      "강한 각질 제거 성분 주의",
      "고함량 레티노이드 주의",
      "강한 향료 주의",
      "고함량 변성 알코올 주의",
      "새 제품은 한 번에 하나씩",
      "단순 루틴 우선",
    ];
  }
  if (isLowSensitivity(sensitivity)) {
    return ["활성 성분은 일반적인 단계적 도입을 권장합니다"];
  }
  return ["활성 성분을 천천히 도입", "과도한 중복 사용 주의"];
}

function collectConcernIngredients(
  concerns: string[],
  highSensitivity: boolean
): { ingredients: string[]; cautionIngredients: string[] } {
  const raw: string[] = [];
  const caution: string[] = [];

  for (const c of concerns) {
    const list = CONCERN_INGREDIENTS[c as ConcernKey];
    if (!list) continue;
    for (const ing of list) {
      if (
        highSensitivity &&
        (ing === SALICYLIC || ing === RETINOID || ing === RETINOL)
      ) {
        if (!caution.includes(ing)) caution.push(ing);
        continue;
      }
      raw.push(ing);
    }
  }

  if (highSensitivity && (concerns.includes("색소침착") || concerns.includes("칙칙함"))) {
    const hint = "고함량 비타민 C·강한 산성 제형 주의";
    if (!caution.includes(hint)) caution.push(hint);
  }

  const ingredients = displayIngredientNames(raw, "ko").slice(
    0,
    MAX_INGREDIENTS
  );
  const cautionIngredients = displayIngredientNames(
    caution.filter(
      (c) => c === SALICYLIC || c === RETINOID || c === RETINOL
    ),
    "ko"
  );

  // 비성분 주의 문구는 KO 라벨 변환 없이 유지
  for (const c of caution) {
    if (
      c !== SALICYLIC &&
      c !== RETINOID &&
      c !== RETINOL &&
      !cautionIngredients.includes(c)
    ) {
      cautionIngredients.push(c);
    }
  }

  return { ingredients, cautionIngredients };
}

function dedupeRoutineSteps(steps: RoutineStep[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const step of steps) {
    if (seen.has(step.key)) continue;
    seen.add(step.key);
    out.push(step.label);
  }
  return out;
}

function buildRoutines(
  concerns: string[],
  highSensitivity: boolean
): { morning_tips: string[]; evening_tips: string[] } {
  const morning: RoutineStep[] = [
    { key: "cleanse", label: "순한 세안" },
    { key: "moisturize", label: "보습" },
    { key: "spf", label: "자외선 차단" },
  ];
  const evening: RoutineStep[] = [
    { key: "cleanse", label: "순한 세안" },
    { key: "moisturize", label: "보습" },
  ];

  if (!highSensitivity) {
    const addOn: Partial<Record<ConcernKey, RoutineStep>> = {
      건조함: { key: "serum-moisture", label: "보습 세럼" },
      붉은기: { key: "serum-calm", label: "진정 세럼" },
      색소침착: { key: "serum-bright", label: "저자극 브라이트닝 세럼" },
      칙칙함: { key: "serum-bright", label: "저자극 브라이트닝 세럼" },
      주름: { key: "serum-age", label: "저자극 기능성 제품" },
      노화방지: { key: "serum-age", label: "저자극 기능성 제품" },
      여드름: { key: "spot-care", label: "저자극 국소·각질 관리(참고)" },
      모공: { key: "pore-care", label: "저자극 각질·피지 관리(참고)" },
      자외선: { key: "spf-boost", label: "자외선 차단 재확인" },
    };
    // 고민 선택 순서대로 최대 1단계(첫 매칭 고민만)
    for (const c of concerns) {
      const step = addOn[c as ConcernKey];
      if (!step) continue;
      morning.push(step);
      evening.push(step);
      break;
    }
  }

  return {
    morning_tips: dedupeRoutineSteps(morning),
    evening_tips: dedupeRoutineSteps(evening),
  };
}

function buildToneNote(skinTone: string, undertone: string): string {
  const tone = skinTone.trim() || "중간";
  const under = undertone.trim() || "중립";
  return [
    `피부톤(${tone})·언더톤(${under})은 색조 제품 선택에 더 직접적으로 활용됩니다.`,
    "기초 스킨케어 미리보기에서는 피부 고민과 민감도를 우선 반영합니다.",
  ].join(" ");
}

function buildRednessPreviewNotes(
  obs: RednessObservation | undefined
): { notes: string[]; counselingNote_ko: string | null } {
  const notes: string[] = [];
  if (!obs || !hasRednessObservation(obs)) {
    return { notes, counselingNote_ko: null };
  }

  if (obs.trigger === "sun_exposure") {
    notes.push("햇빛 노출 후에는 진정·보습·자외선 차단을 우선 참고하세요.");
  }
  if (
    obs.trigger === "after_cosmetic" &&
    Array.isArray(obs.symptoms) &&
    obs.symptoms.includes("stinging")
  ) {
    notes.push(
      "화장품 사용 후 따가움이 있으면 새 제품 사용을 중단하고 단순 루틴을 유지하세요. 불편감이 지속되면 상담을 고려하세요."
    );
  }
  if (
    Array.isArray(obs.symptoms) &&
    (obs.symptoms.includes("dryness_tightness") ||
      obs.symptoms.includes("flaking"))
  ) {
    notes.push("당김·각질이 있으면 장벽 보습 중심으로 단순화해 보세요.");
  }

  const counselingNote_ko = isRednessCounselingPriority(obs)
    ? "제품 선택보다 전문가 상담을 먼저 고려하세요. 이 안내는 진단이 아닙니다."
    : null;

  notes.push(
    "입력하신 붉어 보이는 상태에 대한 관찰은 참고용이며, 원인을 진단한 결과가 아닙니다."
  );

  return { notes, counselingNote_ko };
}

/**
 * 현재 선택값만으로 참고 미리보기를 만든다.
 * 치료·개선 보장·질환명·구매 유도·managementLevel 확정 금지.
 */
export function buildAnalyzeReferencePreview(
  input: CurrentAnalyzeInput
): AnalyzeReferencePreview {
  const concerns =
    input.concerns.length > 0 ? [...input.concerns] : ["붉은기"];
  const sensitivity = input.sensitivity.trim() || "보통";
  const skinTone = input.skinTone.trim() || "중간";
  const undertone = input.undertone.trim() || "중립";
  const highSensitivity = isHighSensitivity(sensitivity);

  const { ingredients, cautionIngredients } = collectConcernIngredients(
    concerns,
    highSensitivity
  );
  const avoidHints = buildSensitivityAvoidHints(sensitivity);
  const { morning_tips, evening_tips } = buildRoutines(
    concerns,
    highSensitivity
  );
  const toneNote_ko = buildToneNote(skinTone, undertone);
  const { notes: rednessNotes, counselingNote_ko } = buildRednessPreviewNotes(
    input.rednessObservation
  );

  const summaryParts = [
    `선택하신 고민(${concerns.join(", ")})·민감도(${sensitivity})를 기준으로 한 참고 안내입니다.`,
    "AI 분석 전 미리보기이며, 의료 진단이 아닙니다.",
    toneNote_ko,
    ...rednessNotes,
  ];

  return {
    kind: "reference_preview",
    skin_type: `고민·민감도 중심 참고 (${sensitivity})`,
    concerns,
    ingredients:
      ingredients.length > 0
        ? ingredients
        : displayIngredientNames(
            ["Panthenol", "Ceramide", "Hyaluronic Acid"],
            "ko"
          ),
    cautionIngredients,
    avoidHints,
    summary_ko: summaryParts.join(" "),
    toneNote_ko,
    morning_tips,
    evening_tips,
    counselingNote_ko,
  };
}

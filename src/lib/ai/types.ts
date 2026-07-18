import type {
  AnalysisResult,
  CurrentProductInput,
  ManagementLevel,
  Recommendation,
} from "@/lib/recommend";
import type { RednessObservation } from "./rednessObservation";

export type {
  RednessArea,
  RednessDuration,
  RednessObservation,
  RednessSymptom,
  RednessTrigger,
} from "./rednessObservation";

/** 서버 전용 AI_PROVIDER 허용 값 */
export type AiProviderId = "mock" | "ollama" | "openai" | "anthropic";

/** 사용자가 선택하는 증상 심각도. 진단값이 아니라 자가 보고 값이다. */
export type SymptomSeverity = "mild" | "moderate" | "severe";

/** 증상 지속 기간. */
export type SymptomDuration =
  | "under_3_days"
  | "under_2_weeks"
  | "under_3_months"
  | "over_3_months"
  | "unknown";

/** MVP 분석 대상 부위. 확장 시 문자열을 추가하되 기존 값은 유지한다. */
export type BodyArea =
  | "forehead"
  | "eye_area"
  | "under_eye"
  | "nose"
  | "cheek"
  | "mouth_area"
  | "chin"
  | "neck"
  | "other";

/** 제품 추천보다 의료기관 확인을 우선할 수 있는 자가 보고 위험 신호. */
export type RedFlag =
  | "pain"
  | "bleeding"
  | "oozing"
  | "rapid_swelling"
  | "spreading_rash"
  | "suspected_infection"
  | "burn"
  | "sudden_mole_change"
  | "eye_irritation"
  | "ear_internal_symptom"
  | "breathing_difficulty"
  | "systemic_allergy";

/** 고민별 선택 입력. 기존 concerns 배열과 함께 사용한다. */
export type ConcernObservation = {
  concern: string;
  areas?: BodyArea[];
  severity?: SymptomSeverity;
  duration?: SymptomDuration;
  worsening?: boolean;
  redFlags?: RedFlag[];
};

/** 사용자 입력 알레르기·회피 성분 + 현재 사용 제품 (선택) */
export type AnalyzeIngredientPreferences = {
  allergyIngredients?: string[];
  avoidedIngredients?: string[];
  currentProducts?: CurrentProductInput[];
  /**
   * 붉은기 관찰 상태 (선택).
   * 진단용이 아니며, 비워도 분석 가능.
   */
  rednessObservation?: RednessObservation;
  /**
   * 고민별 부위·심각도·기간·위험 신호 (선택).
   * 기존 클라이언트와의 호환을 위해 optional로 유지한다.
   */
  concernObservations?: ConcernObservation[];
};

/** POST /api/analyze 요청 — 클라이언트는 키·모델 ID를 보내지 않는다. */
export type AnalyzeSkinRequest =
  | ({
      mode: "photo";
      /** 라우트 검증용. 프로바이더에는 이미지를 보내지 않는다. */
      imageBase64: string;
      mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    } & AnalyzeIngredientPreferences)
  | ({
      mode: "manual";
      skinTone: string;
      undertone: string;
      concerns: string[];
      sensitivity: string;
    } & AnalyzeIngredientPreferences);

export type { CurrentProductInput };

export type AnalyzeProviderSource = AiProviderId;

/** POST /api/analyze 성공 응답 */
export type AnalyzeSkinResponse = {
  analysis: AnalysisResult;
  recommendation: Recommendation;
  source: AnalyzeProviderSource;
};

export type AnalyzeSkinErrorBody = {
  error: string;
  code?: "BAD_REQUEST" | "CONFIG" | "PROVIDER" | "PARSE";
};

export type { ManagementLevel };

/** validateRecommendation 정규화 결과 (= Recommendation) */
export type NormalizedRecommendation = Recommendation;

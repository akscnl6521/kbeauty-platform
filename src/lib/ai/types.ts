import type {
  AnalysisResult,
  CurrentProductInput,
  ManagementLevel,
  Recommendation,
} from "@/lib/recommend";

/** 서버 전용 AI_PROVIDER 허용 값 */
export type AiProviderId = "mock" | "ollama" | "openai" | "anthropic";

/** 사용자 입력 알레르기·회피 성분 + 현재 사용 제품 (선택) */
export type AnalyzeIngredientPreferences = {
  allergyIngredients?: string[];
  avoidedIngredients?: string[];
  currentProducts?: CurrentProductInput[];
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

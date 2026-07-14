import { analyzeWithAnthropic } from "./analyzeWithAnthropic";
import { analyzeWithMock } from "./analyzeWithMock";
import {
  analyzeWithOllama,
  isOllamaUnavailableError,
} from "./analyzeWithOllama";
import { analyzeWithOpenAI } from "./analyzeWithOpenAI";
import { AnalyzeSkinError } from "./errors";
import {
  getRequestAllergyIngredients,
  getRequestAvoidedIngredients,
  getRequestCurrentProducts,
} from "./prompt";
import type {
  AiProviderId,
  AnalyzeSkinRequest,
  AnalyzeSkinResponse,
} from "./types";
import { applyUserIngredientPreferences } from "@/lib/recommend/applyUserIngredientPreferences";
import { mergeCurrentRoutineIntoRecommendation } from "@/lib/recommend/currentProduct";
import { applyEvidenceToRecommendation } from "@/lib/evidence";
import { resolveApprovedEvidenceForConcerns } from "@/lib/evidence/loadApprovedEvidence";
import { applyRednessObservationToRecommendation } from "./rednessObservation";

export { AnalyzeSkinError } from "./errors";

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

function logDevAi(event: {
  provider: AiProviderId | "unset" | "invalid";
  success: boolean;
  mockFallback: boolean;
  errorCode?: string;
}): void {
  if (!isDevelopment()) return;
  // 키·원문 응답·사용자 상세 입력은 기록하지 않음
  console.log("[ai]", {
    provider: event.provider,
    success: event.success,
    mockFallback: event.mockFallback,
    ...(event.errorCode ? { errorCode: event.errorCode } : {}),
  });
}

export type ResolveAiProviderResult = {
  provider: AiProviderId;
  mockFallback: boolean;
  /**
   * development + AI_PROVIDER 미설정:
   * Ollama 우선 시도, 실패 시 mock 폴백.
   */
  tryOllamaThenMock: boolean;
};

/**
 * AI_PROVIDER 해석.
 * - development + 미설정 → Ollama 시도 후 mock 폴백
 * - production + 미설정 → CONFIG (openai 권장)
 * - production + mock → CONFIG
 * - ollama 는 명시 설정 시에만 사용 (프로덕션 묵시 기본값 아님)
 */
export function resolveAiProvider(): ResolveAiProviderResult {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  const dev = isDevelopment();

  if (!raw) {
    if (dev) {
      return {
        provider: "ollama",
        mockFallback: false,
        tryOllamaThenMock: true,
      };
    }
    throw new AnalyzeSkinError(
      "AI_PROVIDER is not configured. Set AI_PROVIDER=openai (recommended) or anthropic.",
      500,
      "CONFIG"
    );
  }

  if (raw === "mock") {
    if (!dev) {
      throw new AnalyzeSkinError(
        "AI_PROVIDER=mock is not allowed in production.",
        500,
        "CONFIG"
      );
    }
    return {
      provider: "mock",
      mockFallback: false,
      tryOllamaThenMock: false,
    };
  }

  if (raw === "ollama") {
    // 명시적 설정만 허용 — 프로덕션 묵시 기본값으로 쓰지 않음
    return {
      provider: "ollama",
      mockFallback: false,
      tryOllamaThenMock: false,
    };
  }

  if (raw === "openai" || raw === "anthropic") {
    return {
      provider: raw,
      mockFallback: false,
      tryOllamaThenMock: false,
    };
  }

  throw new AnalyzeSkinError(
    "Invalid AI_PROVIDER. Supported values: mock, ollama, openai, anthropic.",
    500,
    "CONFIG"
  );
}

async function runProvider(
  provider: AiProviderId,
  input: AnalyzeSkinRequest
): Promise<AnalyzeSkinResponse> {
  switch (provider) {
    case "mock":
      return analyzeWithMock(input);
    case "ollama":
      return analyzeWithOllama(input);
    case "openai":
      return analyzeWithOpenAI(input);
    case "anthropic":
      return analyzeWithAnthropic(input);
    default: {
      const _exhaustive: never = provider;
      throw new AnalyzeSkinError(
        `Unhandled provider: ${String(_exhaustive)}`,
        500,
        "CONFIG"
      );
    }
  }
}

async function attachUserIngredientPreferences(
  input: AnalyzeSkinRequest,
  result: AnalyzeSkinResponse
): Promise<AnalyzeSkinResponse> {
  const allergy = getRequestAllergyIngredients(input);
  const avoided = getRequestAvoidedIngredients(input);
  const currentProducts = getRequestCurrentProducts(input);

  let recommendation = applyUserIngredientPreferences(
    result.recommendation,
    allergy,
    avoided
  );
  recommendation = mergeCurrentRoutineIntoRecommendation(
    recommendation,
    currentProducts,
    allergy,
    avoided
  );
  recommendation = applyRednessObservationToRecommendation(
    recommendation,
    input.rednessObservation
  );
  const evidenceLinks = await resolveApprovedEvidenceForConcerns(
    recommendation.skinConcerns ?? []
  );
  recommendation = applyEvidenceToRecommendation(
    recommendation,
    evidenceLinks
  );

  return {
    ...result,
    analysis: {
      ...result.analysis,
      ingredients: recommendation.recommendedIngredients,
    },
    recommendation,
  };
}

/**
 * Sprint 5 Phase 3 — 프로바이더 선택 후 분석.
 * 개발 기본: Ollama → 불가 시 mock. 프로덕션 권장: openai.
 */
export async function analyzeSkin(
  input: AnalyzeSkinRequest
): Promise<AnalyzeSkinResponse> {
  let provider: AiProviderId | "unset" | "invalid" = "unset";
  let mockFallback = false;

  try {
    const resolved = resolveAiProvider();
    provider = resolved.provider;
    mockFallback = resolved.mockFallback;

    let result: AnalyzeSkinResponse;

    if (resolved.tryOllamaThenMock) {
      try {
        result = await analyzeWithOllama(input);
        provider = "ollama";
        mockFallback = false;
        result = await attachUserIngredientPreferences(input, result);
        logDevAi({
          provider: "ollama",
          success: true,
          mockFallback: false,
        });
        return result;
      } catch (e) {
        if (!isOllamaUnavailableError(e)) {
          throw e;
        }
        // Ollama 불가 → 명시적 mock 폴백
        result = await analyzeWithMock(input);
        provider = "mock";
        mockFallback = true;
        result = await attachUserIngredientPreferences(input, result);
        logDevAi({
          provider: "mock",
          success: true,
          mockFallback: true,
        });
        return result;
      }
    }

    result = await runProvider(resolved.provider, input);
    result = await attachUserIngredientPreferences(input, result);

    logDevAi({
      provider,
      success: true,
      mockFallback,
    });
    return result;
  } catch (e) {
    const code = e instanceof AnalyzeSkinError ? e.code : "PROVIDER";
    if (e instanceof AnalyzeSkinError && e.code === "CONFIG") {
      const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
      if (
        raw &&
        raw !== "mock" &&
        raw !== "ollama" &&
        raw !== "openai" &&
        raw !== "anthropic"
      ) {
        provider = "invalid";
      } else if (!raw) {
        provider = "unset";
      } else {
        provider = raw as AiProviderId;
      }
    }
    logDevAi({
      provider,
      success: false,
      mockFallback,
      errorCode: code,
    });
    throw e;
  }
}

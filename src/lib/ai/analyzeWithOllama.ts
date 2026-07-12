import { normalizeAnalysisResult } from "@/lib/recommend";
import { AnalyzeSkinError } from "./errors";
import {
  AI_JSON_SYSTEM_PROMPT,
  DEFAULT_MAX_TOKENS,
  buildBasicInfoUserText,
} from "./prompt";
import type { AnalyzeSkinRequest, AnalyzeSkinResponse } from "./types";
import { validateRecommendation } from "./validateRecommendation";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2";
/** Ollama 로컬 연결 대기 상한 (ms) */
const OLLAMA_TIMEOUT_MS = 10_000;

function parseJsonContent(contentText: string): unknown {
  try {
    return JSON.parse(contentText);
  } catch {
    const match = contentText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
  }
  throw new AnalyzeSkinError(
    "Failed to parse Ollama analysis result.",
    500,
    "PARSE"
  );
}

function resolveOllamaBaseUrl(): string {
  const fromEnv = process.env.OLLAMA_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return DEFAULT_OLLAMA_BASE_URL;
  }
  throw new AnalyzeSkinError(
    "OLLAMA_BASE_URL is not configured on the server.",
    500,
    "CONFIG"
  );
}

function resolveOllamaModel(): string {
  const model = process.env.OLLAMA_MODEL?.trim();
  if (model) return model;
  return DEFAULT_OLLAMA_MODEL;
}

/** Ollama 연결/타임아웃 실패인지 (dev mock 폴백 판별용) */
export function isOllamaUnavailableError(e: unknown): boolean {
  return (
    e instanceof AnalyzeSkinError &&
    e.code === "PROVIDER" &&
    e.message.startsWith("Ollama")
  );
}

/**
 * Ollama /api/chat — fetch 전용, 이미지 미전송.
 * NEXT_PUBLIC 변수는 사용하지 않는다.
 */
export async function analyzeWithOllama(
  input: AnalyzeSkinRequest
): Promise<AnalyzeSkinResponse> {
  const baseUrl = resolveOllamaBaseUrl();
  const model = resolveOllamaModel();
  const maxTokensRaw = process.env.AI_MAX_TOKENS;
  const maxTokens =
    maxTokensRaw && Number.isFinite(Number(maxTokensRaw))
      ? Number(maxTokensRaw)
      : DEFAULT_MAX_TOKENS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { num_predict: maxTokens },
        messages: [
          { role: "system", content: AI_JSON_SYSTEM_PROMPT },
          { role: "user", content: buildBasicInfoUserText(input) },
        ],
      }),
    });
  } catch (e) {
    const aborted =
      (e instanceof Error && e.name === "AbortError") ||
      (typeof e === "object" &&
        e !== null &&
        "name" in e &&
        (e as { name: string }).name === "AbortError");

    if (aborted) {
      throw new AnalyzeSkinError(
        `Ollama connection timed out after ${OLLAMA_TIMEOUT_MS}ms. Is Ollama running at ${baseUrl}?`,
        500,
        "PROVIDER"
      );
    }

    throw new AnalyzeSkinError(
      `Ollama is unreachable at ${baseUrl}. Start Ollama or check OLLAMA_BASE_URL.`,
      500,
      "PROVIDER"
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AnalyzeSkinError(
      `Ollama provider error (${response.status}). Check OLLAMA_MODEL and that the model is pulled.`,
      500,
      "PROVIDER"
    );
  }

  const json: unknown = await response.json();
  const contentText =
    typeof json === "object" &&
    json !== null &&
    typeof (json as { message?: { content?: unknown } }).message?.content ===
      "string"
      ? ((json as { message: { content: string } }).message.content as string)
      : undefined;

  if (!contentText?.trim()) {
    throw new AnalyzeSkinError(
      "Ollama returned no message content.",
      500,
      "PROVIDER"
    );
  }

  const raw = parseJsonContent(contentText);
  const analysis = normalizeAnalysisResult(raw);
  const recommendation = validateRecommendation(raw);

  return { analysis, recommendation, source: "ollama" };
}

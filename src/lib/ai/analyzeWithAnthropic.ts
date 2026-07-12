import { normalizeAnalysisResult } from "@/lib/recommend";
import { AnalyzeSkinError } from "./errors";
import {
  AI_JSON_SYSTEM_PROMPT,
  DEFAULT_MAX_TOKENS,
  buildBasicInfoUserText,
} from "./prompt";
import type { AnalyzeSkinRequest, AnalyzeSkinResponse } from "./types";
import { validateRecommendation } from "./validateRecommendation";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

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
    "Failed to parse Anthropic analysis result.",
    500,
    "PARSE"
  );
}

/** Anthropic Messages — fetch 전용, 이미지 미전송 (텍스트만) */
export async function analyzeWithAnthropic(
  input: AnalyzeSkinRequest
): Promise<AnalyzeSkinResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new AnalyzeSkinError(
      "ANTHROPIC_API_KEY is not configured on the server.",
      500,
      "CONFIG"
    );
  }

  const model =
    process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  const maxTokensRaw = process.env.AI_MAX_TOKENS;
  const maxTokens =
    maxTokensRaw && Number.isFinite(Number(maxTokensRaw))
      ? Number(maxTokensRaw)
      : DEFAULT_MAX_TOKENS;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: AI_JSON_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildBasicInfoUserText(input),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new AnalyzeSkinError(
      `Anthropic provider error (${response.status}).`,
      500,
      "PROVIDER"
    );
  }

  const json: unknown = await response.json();
  const contentText =
    typeof json === "object" &&
    json !== null &&
    Array.isArray((json as { content?: unknown }).content) &&
    typeof (
      (json as { content: { text?: unknown }[] }).content[0]?.text
    ) === "string"
      ? ((json as { content: { text: string }[] }).content[0].text as string)
      : undefined;

  if (!contentText?.trim()) {
    throw new AnalyzeSkinError(
      "No content returned from Anthropic.",
      500,
      "PROVIDER"
    );
  }

  const raw = parseJsonContent(contentText);
  const analysis = normalizeAnalysisResult(raw);
  const recommendation = validateRecommendation(raw);

  return { analysis, recommendation, source: "anthropic" };
}

import { normalizeAnalysisResult } from "@/lib/recommend";
import { AnalyzeSkinError } from "./errors";
import {
  AI_JSON_SYSTEM_PROMPT,
  DEFAULT_MAX_TOKENS,
  buildBasicInfoUserText,
} from "./prompt";
import type { AnalyzeSkinRequest, AnalyzeSkinResponse } from "./types";
import { validateRecommendation } from "./validateRecommendation";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

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
    "Failed to parse OpenAI analysis result.",
    500,
    "PARSE"
  );
}

/** OpenAI Chat Completions — fetch 전용, 이미지 미전송 */
export async function analyzeWithOpenAI(
  input: AnalyzeSkinRequest
): Promise<AnalyzeSkinResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AnalyzeSkinError(
      "OPENAI_API_KEY is not configured on the server.",
      500,
      "CONFIG"
    );
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const maxTokensRaw = process.env.AI_MAX_TOKENS;
  const maxTokens =
    maxTokensRaw && Number.isFinite(Number(maxTokensRaw))
      ? Number(maxTokensRaw)
      : DEFAULT_MAX_TOKENS;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AI_JSON_SYSTEM_PROMPT },
        { role: "user", content: buildBasicInfoUserText(input) },
      ],
    }),
  });

  if (!response.ok) {
    throw new AnalyzeSkinError(
      `OpenAI provider error (${response.status}).`,
      500,
      "PROVIDER"
    );
  }

  const json: unknown = await response.json();
  const contentText =
    typeof json === "object" &&
    json !== null &&
    Array.isArray((json as { choices?: unknown }).choices) &&
    typeof (
      (json as { choices: { message?: { content?: unknown } }[] }).choices[0]
        ?.message?.content
    ) === "string"
      ? ((
          json as {
            choices: { message: { content: string } }[];
          }
        ).choices[0].message.content as string)
      : undefined;

  if (!contentText?.trim()) {
    throw new AnalyzeSkinError(
      "No content returned from OpenAI.",
      500,
      "PROVIDER"
    );
  }

  const raw = parseJsonContent(contentText);
  const analysis = normalizeAnalysisResult(raw);
  const recommendation = validateRecommendation(raw);

  return { analysis, recommendation, source: "openai" };
}

import type { AnalyzeSkinRequest } from "./types";

/** Phase 2: 이미지 없이 기본 정보(텍스트)만 프로바이더에 전달 */
export function buildBasicInfoUserText(input: AnalyzeSkinRequest): string {
  if (input.mode === "manual") {
    return `Skin info (Korean labels):
- skin_tone: ${input.skinTone}
- undertone: ${input.undertone}
- main_concerns: ${input.concerns.join(", ")}
- sensitivity: ${input.sensitivity}
Return JSON only.`;
  }

  // photo 모드도 Phase 2에서는 이미지를 보내지 않음
  return `Skin analysis requested in photo mode.
No image is attached in this phase — provide general K-beauty guidance JSON based on typical sensitive-skin care.
Return JSON only.`;
}

export const AI_JSON_SYSTEM_PROMPT =
  'You are a K-beauty skincare information guide. Based on the skin information provided, analyze and respond ONLY in JSON: {"skin_type": "string", "concerns": ["string"], "ingredients": ["string"], "ingredients_to_avoid": ["string"], "summary_ko": "Korean summary", "summary_en": "English summary", "summary_ja": "Japanese summary", "routine_tips": ["string"], "confidence_score": 0.0}';

export const DEFAULT_MAX_TOKENS = 700;

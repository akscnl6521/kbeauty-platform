import type { AnalyzeSkinRequest } from "./types";
import type { CurrentProductInput } from "@/lib/recommend";
import { normalizeCurrentProducts } from "@/lib/recommend/currentProduct";

/** 요청 body에서 선택 성분 배열 정규화 (trim·빈값·중복 제거) */
export function normalizeIngredientTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function getRequestAllergyIngredients(
  input: AnalyzeSkinRequest
): string[] {
  return normalizeIngredientTagList(input.allergyIngredients);
}

export function getRequestAvoidedIngredients(
  input: AnalyzeSkinRequest
): string[] {
  return normalizeIngredientTagList(input.avoidedIngredients);
}

export function getRequestCurrentProducts(
  input: AnalyzeSkinRequest
): CurrentProductInput[] {
  return normalizeCurrentProducts(input.currentProducts);
}

function formatCurrentProductsBlock(products: CurrentProductInput[]): string {
  if (products.length === 0) {
    return `(none provided — do not invent a current routine)`;
  }
  return products
    .map((p, i) => {
      const lines = [
        `${i + 1}. productName: ${p.productName}`,
        p.brandName ? `   brandName: ${p.brandName}` : null,
        p.category ? `   category: ${p.category}` : null,
        p.usageTime ? `   usageTime: ${p.usageTime}` : null,
        p.usageFrequency ? `   usageFrequency: ${p.usageFrequency}` : null,
        p.keyIngredients && p.keyIngredients.length > 0
          ? `   keyIngredients (user-stated only): ${p.keyIngredients.join(", ")}`
          : `   keyIngredients: (none — do NOT invent full INCI from the product name)`,
        p.reaction ? `   reaction: ${p.reaction}` : null,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n");
}

/**
 * 기본 정보(텍스트)만 프로바이더에 전달.
 * Phase 2+: 이미지는 전송하지 않는다.
 */
export function buildBasicInfoUserText(input: AnalyzeSkinRequest): string {
  const allergy = getRequestAllergyIngredients(input);
  const avoided = getRequestAvoidedIngredients(input);
  const currentProducts = getRequestCurrentProducts(input);
  const allergyLine =
    allergy.length > 0
      ? allergy.join(", ")
      : "(none provided — do not invent allergies)";
  const avoidedLine =
    avoided.length > 0
      ? avoided.join(", ")
      : "(none provided — do not invent avoided ingredients)";

  const safetyBlock = `
User-stated ingredient preferences (use only if provided; do not invent):
- allergyIngredients: ${allergyLine}
- avoidedIngredients: ${avoidedLine}

Ingredient safety rules for this request:
- Never put allergyIngredients into recommendedIngredients.
- Exclude avoidedIngredients from recommendedIngredients.
- Include both allergyIngredients and avoidedIngredients in ingredientsToAvoid.
- Do not diagnose allergies or medical conditions.
- If an ingredient conflicts with allergy/avoid lists, exclude it clearly (do not only lower confidenceScore).

Current products in use (structured; use only stated fields):
${formatCurrentProductsBlock(currentProducts)}

Current-routine review rules:
- Do not invent full ingredient lists from product names alone.
- Use only user-stated keyIngredients as evidence for ingredient overlap.
- If similar-purpose products look excessive, suggest simplification (not a medical ban).
- If exfoliating/active-like ingredients appear in multiple products (from stated keys only), warn gently.
- If reaction is stinging, redness, or breakout, prioritize pause/simplify over adding new products.
- If stated product ingredients conflict with allergy/avoid lists, warn clearly.
- Fill optional arrays when useful: currentRoutineIssues, duplicateFunctions, routineSimplificationSuggestions, currentProductWarnings, suggestedMorningOrder, suggestedEveningOrder.
- Never use diagnostic or absolute contraindication language.`;

  if (input.mode === "manual") {
    return `K-Beauty Match — manual skin information (do not invent missing facts).

Provided fields only:
- skinTone: ${input.skinTone}
- undertone: ${input.undertone}
- concerns: ${input.concerns.join(", ")}
- sensitivity: ${input.sensitivity}
${safetyBlock}

Rules for this request:
- Do not assume allergies, pregnancy, diagnosed medical conditions, medications, or history that the user did not provide.
- Do not diagnose disease. This is cosmetic/skincare guidance only.
- Separate what may be manageable with cosmetics from what needs observation or professional care.
- If information is insufficient, avoid guessing and lower confidenceScore.
- Respond with one valid JSON object only (no markdown, no prose outside JSON).`;
  }

  // photo 모드: 현재 단계에서는 실제 이미지가 프로바이더로 전달되지 않음
  return `K-Beauty Match — photo mode (current platform stage).

Important:
- A photo mode request was made, but no real image pixels are attached to the model in this stage.
- Do NOT claim you inspected, saw, or analyzed a photo.
- Do NOT invent facial findings from an image.
- Return only general, safety-first K-beauty guidance JSON for incomplete information.
- Prefer lower confidenceScore and clear cosmetic limitations.
- Do not diagnose disease. Respond with one valid JSON object only.
${safetyBlock}`;
}

/**
 * Master Plan 기준 JSON 계약 + 안전 원칙.
 * 응답은 설명/마크다운 없이 JSON 하나만.
 */
export const AI_JSON_SYSTEM_PROMPT = `You are a K-Beauty Match skincare information guide — not a doctor.
Return ONLY one valid JSON object matching this schema (no markdown, no extra text):

{
  "skinType": "string",
  "skinConcerns": ["string"],
  "recommendedIngredients": ["string"],
  "ingredientsToAvoid": ["string"],
  "managementLevel": "cosmetic_care",
  "manageableWithCosmetics": ["string"],
  "cosmeticLimitations": ["string"],
  "morningRoutine": ["string"],
  "eveningRoutine": ["string"],
  "precautions": ["string"],
  "notRecommendedReasons": ["string"],
  "expertReferralReasons": ["string"],
  "currentRoutineIssues": ["string"],
  "duplicateFunctions": ["string"],
  "routineSimplificationSuggestions": ["string"],
  "currentProductWarnings": ["string"],
  "suggestedMorningOrder": ["string"],
  "suggestedEveningOrder": ["string"],
  "summaryKo": "string",
  "summaryEn": "string",
  "summaryJa": "string",
  "confidenceScore": 0.0
}

managementLevel must be exactly one of:
"cosmetic_care" | "observe" | "combined_care" | "expert_first" | "urgent_check"

Safety rules:
1. Do not diagnose skin disease or confirm allergies.
2. Do not force product recommendations for every concern.
3. Separate cosmetic-manageable scope from limitations.
4. If pain, bleeding, discharge/oozing, sudden swelling, spreading rash, suspected infection, burns, sudden mole changes, eye-interior irritation, ear-interior symptoms, breathing difficulty, or systemic allergic reaction are suggested → use "expert_first" or "urgent_check".
5. When red-flag signals exist, do not push product purchase; fill notRecommendedReasons and expertReferralReasons instead.
6. If information is insufficient, do not invent facts; return a lower confidenceScore (0–1).
7. Do not present ingredient combinations as medical contraindications.
8. Include summaryKo, summaryEn, and summaryJa.
9. If photo mode without a real image, never claim you saw the photo.
10. confidenceScore is a number between 0 and 1.
11. Never recommend user-stated allergyIngredients. Exclude user-stated avoidedIngredients from recommendedIngredients. Put both into ingredientsToAvoid.
12. Never invent full INCI from product names. Use only user-stated keyIngredients for current-routine ingredient reasoning.
13. When current products are provided, fill the current-routine optional arrays when relevant; keep language non-diagnostic.`;

/** 확장 JSON을 위해 여유 토큰 */
export const DEFAULT_MAX_TOKENS = 1600;

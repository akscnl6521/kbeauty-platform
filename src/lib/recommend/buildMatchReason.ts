import {
  evidenceCitationHref,
  evidenceLevelLabelKo,
} from "@/lib/evidence/types";
import { evidenceForMatchedIngredients } from "@/lib/evidence/applyEvidenceToRecommendation";
import {
  REDNESS_DURATION_LABEL_KO,
  REDNESS_SYMPTOM_LABEL_KO,
  REDNESS_TRIGGER_LABEL_KO,
} from "@/lib/ai/rednessObservation";
import { displayIngredientNames } from "./displayIngredientName";
import type { RankableProduct, Recommendation } from "./types";

type Locale = "ko" | "en" | "ja";

function uniqueNonEmpty(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function concernLabels(recommendation: Recommendation): string[] {
  return uniqueNonEmpty(recommendation.skinConcerns ?? []);
}

function observationLabelsKo(recommendation: Recommendation): string[] {
  const obs = recommendation.rednessObservation;
  if (!obs) return [];
  const out: string[] = [];
  if (obs.trigger && REDNESS_TRIGGER_LABEL_KO[obs.trigger]) {
    out.push(REDNESS_TRIGGER_LABEL_KO[obs.trigger]);
  }
  if (obs.duration && REDNESS_DURATION_LABEL_KO[obs.duration]) {
    out.push(REDNESS_DURATION_LABEL_KO[obs.duration]);
  }
  for (const s of obs.symptoms ?? []) {
    const label = REDNESS_SYMPTOM_LABEL_KO[s];
    if (label) out.push(label);
  }
  return uniqueNonEmpty(out);
}

/**
 * 증상(선택) → 근거 성분 → 제품 매칭 성분을 문장으로 연결.
 * 구매 권유가 아니라 적합도 설명용.
 */
export function buildMatchReason(options: {
  recommendation: Recommendation;
  matchedIngredients: string[];
  product?: RankableProduct | null;
  locale?: Locale;
}): string {
  const locale = options.locale ?? "ko";
  const matched = displayIngredientNames(
    options.matchedIngredients ?? [],
    locale
  );
  const concerns = concernLabels(options.recommendation);
  const obsKo = observationLabelsKo(options.recommendation);
  const evHits = evidenceForMatchedIngredients(
    options.recommendation.evidenceLinks,
    options.matchedIngredients ?? []
  );
  const citationBits = evHits.slice(0, 2).map((e) => {
    const lvl = evidenceLevelLabelKo(e.evidenceLevel);
    const id = e.pmid ? `PMID ${e.pmid}` : e.doi ? `DOI ${e.doi}` : "출처";
    return `${e.ingredientNameKo || e.ingredientNameEn} (${lvl}, ${id})`;
  });

  if (locale === "ko") {
    const concernPart =
      concerns.length > 0
        ? `선택하신 「${concerns.slice(0, 3).join("·")}」`
        : "선택하신 피부 상태";
    const obsPart =
      obsKo.length > 0 ? ` (관찰: ${obsKo.slice(0, 3).join("·")})` : "";
    const citePart =
      citationBits.length > 0
        ? ` 공개된 성분 근거: ${citationBits.join("; ")}.`
        : "";
    if (matched.length > 0) {
      return `${concernPart}${obsPart} → 근거 성분 「${matched.slice(0, 4).join("·")}」 → 이 제품 주요 성분과 연결됩니다.${citePart} 제품 전체 치료 효과는 단정하지 않습니다.`;
    }
    return `${concernPart}${obsPart}에 맞춘 한국 브랜드 보조 관리 참고 제품입니다. 새 구매 권유가 아닙니다.`;
  }

  if (locale === "ja") {
    const concernPart =
      concerns.length > 0
        ? `選択「${concerns.slice(0, 3).join("・")}」`
        : "選択した肌の状態";
    if (matched.length > 0) {
      return `${concernPart} → 根拠成分「${matched.slice(0, 4).join("・")}」→ この製品の主要成分と接続。製品全体の治療効果は断定しません。`;
    }
    return `${concernPart}向けの韓国ブランド補助ケア参考です。購入推奨ではありません。`;
  }

  const concernPart =
    concerns.length > 0
      ? `your choices (${concerns.slice(0, 3).join(", ")})`
      : "your skin profile";
  if (matched.length > 0) {
    const cite =
      citationBits.length > 0 ? ` Citations: ${citationBits.join("; ")}.` : "";
    return `For ${concernPart} → evidence ingredients (${matched
      .slice(0, 4)
      .join(", ")}) → product key ingredients.${cite} Not a product cure claim.`;
  }
  return `A Korean-brand supportive care reference for ${concernPart}. Not a purchase recommendation.`;
}

export function buildEvidenceCitationItems(options: {
  recommendation: Recommendation;
  matchedIngredients: string[];
}): Array<{ label: string; href: string | null; levelKo: string }> {
  const hits = evidenceForMatchedIngredients(
    options.recommendation.evidenceLinks,
    options.matchedIngredients ?? []
  );
  return hits.slice(0, 3).map((e) => ({
    label: e.pmid
      ? `${e.ingredientNameKo || e.ingredientNameEn} · PMID ${e.pmid}`
      : e.ingredientNameKo || e.ingredientNameEn,
    href: evidenceCitationHref(e),
    levelKo: evidenceLevelLabelKo(e.evidenceLevel),
  }));
}

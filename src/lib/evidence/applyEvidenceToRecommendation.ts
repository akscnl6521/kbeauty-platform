import { toCanonical } from "@/lib/recommend/normalizeIngredient";
import type { Recommendation } from "@/lib/recommend/types";
import { mergeConcernGuidanceIntoLists } from "./concernGuidance";
import type { ApprovedEvidenceLink } from "./types";

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = toCanonical(t) || t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Attach approved concern→ingredient evidence to a recommendation.
 * Pass resolved links (DB ∪ static). Empty links → still attach concern guidance.
 */
export function applyEvidenceToRecommendation(
  recommendation: Recommendation,
  evidence?: ApprovedEvidenceLink[] | null
): Recommendation {
  const links = evidence ?? [];
  const concerns = recommendation.skinConcerns ?? [];

  const { precautions, cautionIngredients } = mergeConcernGuidanceIntoLists({
    concernLabels: concerns,
    precautions: recommendation.precautions,
    ingredientsToAvoid: recommendation.ingredientsToAvoid,
  });

  if (links.length === 0) {
    return {
      ...recommendation,
      precautions,
      ingredientsToAvoid: uniquePreserve([
        ...cautionIngredients,
        ...(recommendation.ingredientsToAvoid ?? []),
      ]),
    };
  }

  const evidenceLabels = uniquePreserve(
    links.map((l) => l.ingredientNameKo || l.ingredientNameEn)
  );

  const recommendedIngredients = uniquePreserve([
    ...evidenceLabels,
    ...(recommendation.recommendedIngredients ?? []),
  ]);

  return {
    ...recommendation,
    recommendedIngredients,
    evidenceLinks: links,
    precautions,
    ingredientsToAvoid: uniquePreserve([
      ...cautionIngredients,
      ...(recommendation.ingredientsToAvoid ?? []),
    ]),
  };
}

/** Matched product ingredient labels → related evidence rows */
export function evidenceForMatchedIngredients(
  links: ApprovedEvidenceLink[] | null | undefined,
  matchedIngredients: string[]
): ApprovedEvidenceLink[] {
  if (!links?.length || !matchedIngredients?.length) return [];
  const matchedCanon = new Set(
    matchedIngredients.map((m) => toCanonical(m)).filter(Boolean)
  );
  return links.filter((link) => {
    const names = [
      link.ingredientNameEn,
      link.ingredientNameKo,
      ...link.aliases,
    ];
    return names.some((n) => {
      const c = toCanonical(n);
      return c && matchedCanon.has(c);
    });
  });
}

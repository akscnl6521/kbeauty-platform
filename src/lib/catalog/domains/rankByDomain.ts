/**
 * Domain recommendation stubs (interfaces + isolation).
 * Face scoring remains in recommend/rankProducts (formula unchanged).
 */

import { filterCandidatesForDomain } from "@/lib/catalog/taxonomy/isolation";
import type { BeautyDomain } from "@/lib/catalog/taxonomy/domains";
import {
  rankHairProducts,
  rankScalpProducts,
  type HairRankInput,
  type HairRankableProduct,
  type ScalpRankInput,
  type ScalpRankableProduct,
} from "@/lib/catalog/scalpHair/rankScalpHair";

export type DomainRankable = {
  id: string;
  category?: string | null;
};

export type DomainRankResult<T> = {
  product: T;
  score: number;
  matchedTags: string[];
  excluded: boolean;
  exclusionReason?: string;
};

function stubRank<T extends DomainRankable>(
  domain: BeautyDomain,
  products: T[],
  scoreFn: (p: T) => { score: number; matchedTags: string[] }
): DomainRankResult<T>[] {
  const pool = filterCandidatesForDomain(domain, products);
  const out: DomainRankResult<T>[] = [];
  for (const p of products) {
    if (!pool.includes(p)) {
      out.push({
        product: p,
        score: 0,
        matchedTags: [],
        excluded: true,
        exclusionReason: "wrong_domain",
      });
      continue;
    }
    const { score, matchedTags } = scoreFn(p);
    out.push({
      product: p,
      score,
      matchedTags,
      excluded: score <= 0,
      exclusionReason: score <= 0 ? "no_tag_match" : undefined,
    });
  }
  return out
    .filter((r) => !r.excluded)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
}

export type SunRankInput = {
  skinType?: string;
  sensitivity?: string;
  finishPreference?: string;
  whiteCastPreference?: string;
  waterResistance?: boolean;
  spfMin?: number;
};

export function rankSunCareProducts(
  input: SunRankInput,
  products: Array<DomainRankable & { spfValue?: number | null; finish?: string | null }>
) {
  return stubRank("sun_care", products, (p) => {
    const matched: string[] = [];
    let score = 0;
    if (input.spfMin != null && p.spfValue != null && p.spfValue >= input.spfMin) {
      score += 1;
      matched.push(`spf>=${input.spfMin}`);
    }
    if (input.finishPreference && p.finish === input.finishPreference) {
      score += 1;
      matched.push(`finish:${p.finish}`);
    }
    if (score === 0 && p.category) {
      score = 0.1;
      matched.push("domain_member");
    }
    return { score, matchedTags: matched };
  });
}

export type LipCareRankInput = {
  dryness?: boolean;
  cracking?: boolean;
  tinted?: boolean;
};

export function rankLipCareProducts(
  input: LipCareRankInput,
  products: Array<DomainRankable & { tinted?: boolean }>
) {
  return stubRank("lip_care", products, (p) => {
    const matched: string[] = [];
    let score = 0.1;
    if (input.tinted != null && p.tinted === input.tinted) {
      score += 1;
      matched.push(input.tinted ? "tinted" : "clear");
    }
    return { score, matchedTags: matched };
  });
}

export type LipColorRankInput = {
  shadeFamily?: string;
  finish?: string;
  opacity?: string;
};

export function rankLipColorProducts(
  input: LipColorRankInput,
  products: Array<
    DomainRankable & {
      shadeFamily?: string | null;
      finish?: string | null;
      hasSwatch?: boolean;
    }
  >
) {
  return stubRank("lip_color", products, (p) => {
    const matched: string[] = [];
    let score = 0;
    if (input.shadeFamily && p.shadeFamily === input.shadeFamily) {
      score += 1;
      matched.push(`shade:${input.shadeFamily}`);
    }
    if (input.finish && p.finish === input.finish) {
      score += 1;
      matched.push(`finish:${input.finish}`);
    }
    if (!p.hasSwatch) {
      matched.push("swatch_missing_warning");
    }
    return { score: Math.max(score, score > 0 ? score : 0), matchedTags: matched };
  });
}

export type BaseMakeupRankInput = {
  finish?: string;
  coverage?: string;
};

export function rankBaseMakeupProducts(
  input: BaseMakeupRankInput,
  products: Array<
    DomainRankable & { finish?: string | null; coverage?: string | null }
  >
) {
  return stubRank("base_makeup", products, (p) => {
    const matched: string[] = [];
    let score = 0;
    if (input.finish && p.finish === input.finish) {
      score += 1;
      matched.push(`finish:${input.finish}`);
    }
    if (input.coverage && p.coverage === input.coverage) {
      score += 1;
      matched.push(`coverage:${input.coverage}`);
    }
    return { score, matchedTags: matched };
  });
}

export type ColorMakeupRankInput = {
  shadeFamily?: string;
  finish?: string;
};

export function rankColorMakeupProducts(
  input: ColorMakeupRankInput,
  products: Array<DomainRankable & { shadeFamily?: string | null; finish?: string | null }>
) {
  return stubRank("color_makeup", products, (p) => {
    const matched: string[] = [];
    let score = 0;
    if (input.shadeFamily && p.shadeFamily === input.shadeFamily) {
      score += 1;
      matched.push(`shade:${input.shadeFamily}`);
    }
    if (input.finish && p.finish === input.finish) {
      score += 1;
      matched.push(`finish:${input.finish}`);
    }
    return { score, matchedTags: matched };
  });
}

export type BodyCareRankInput = {
  dryness?: boolean;
  fragranceSensitive?: boolean;
};

export function rankBodyCareProducts(
  _input: BodyCareRankInput,
  products: DomainRankable[]
) {
  return stubRank("body_care", products, () => ({
    score: 0.1,
    matchedTags: ["domain_member"],
  }));
}

export function rankScalpDomain(input: ScalpRankInput, products: ScalpRankableProduct[]) {
  return rankScalpProducts(input, products);
}

export function rankHairDomain(input: HairRankInput, products: HairRankableProduct[]) {
  return rankHairProducts(input, products);
}

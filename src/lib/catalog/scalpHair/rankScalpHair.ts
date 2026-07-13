/**
 * Separate ranking stubs for scalp / hair.
 * Intentionally does NOT call or modify face rankProducts.
 */

import type {
  HairConcern,
  HairType,
  ScalpConcern,
  ScalpType,
} from "./types";
import { catalogDomainForCategory } from "./categories";
import { assessHairLossObservationSafety } from "./types";
import type { HairLossObservation } from "./types";

export type ScalpRankableProduct = {
  id: string;
  category?: string | null;
  keyIngredients?: string[];
  scalpTypes?: ScalpType[];
  scalpConcerns?: ScalpConcern[];
  functionalClaimVerified?: boolean;
};

export type HairRankableProduct = {
  id: string;
  category?: string | null;
  keyIngredients?: string[];
  hairTypes?: HairType[];
  hairConcerns?: HairConcern[];
};

export type ScalpRankInput = {
  scalpType?: ScalpType;
  scalpConcerns?: ScalpConcern[];
  sensitivity?: string;
  hairLossObservation?: HairLossObservation | null;
};

export type HairRankInput = {
  hairType?: HairType;
  hairConcerns?: HairConcern[];
  colorTreated?: boolean;
  bleached?: boolean;
  heatDamage?: boolean;
};

export type RankedScalpHairProduct<T> = {
  product: T;
  score: number;
  matchedTags: string[];
  excluded: boolean;
  exclusionReason?: string;
};

/**
 * Stub scorer — data/interface only this sprint.
 * Counseling-priority hair-loss observations suppress purchase ranking.
 */
export function rankScalpProducts(
  input: ScalpRankInput,
  products: ScalpRankableProduct[]
): RankedScalpHairProduct<ScalpRankableProduct>[] {
  const safety = assessHairLossObservationSafety(input.hairLossObservation);
  if (
    safety.level === "urgent_check" ||
    safety.level === "professional_consultation"
  ) {
    return products.map((p) => ({
      product: p,
      score: 0,
      matchedTags: [],
      excluded: true,
      exclusionReason: `safety_${safety.level}`,
    }));
  }

  const out: RankedScalpHairProduct<ScalpRankableProduct>[] = [];
  for (const p of products) {
    const domain = catalogDomainForCategory(p.category);
    if (domain !== "scalp" && domain !== "hair_loss_support") {
      out.push({
        product: p,
        score: 0,
        matchedTags: [],
        excluded: true,
        exclusionReason: "wrong_domain",
      });
      continue;
    }
    // Functional hair-loss shampoo without verified claim cannot score
    if (
      p.category === "functional_hair_loss_shampoo" &&
      !p.functionalClaimVerified
    ) {
      out.push({
        product: p,
        score: 0,
        matchedTags: [],
        excluded: true,
        exclusionReason: "unverified_functional_claim",
      });
      continue;
    }

    const matched: string[] = [];
    let score = 0;
    if (
      input.scalpType &&
      input.scalpType !== "unknown" &&
      p.scalpTypes?.includes(input.scalpType)
    ) {
      score += 1;
      matched.push(`scalp_type:${input.scalpType}`);
    }
    for (const c of input.scalpConcerns ?? []) {
      if (c !== "unknown" && p.scalpConcerns?.includes(c)) {
        score += 1;
        matched.push(`scalp_concern:${c}`);
      }
    }
    out.push({
      product: p,
      score,
      matchedTags: matched,
      excluded: score <= 0,
      exclusionReason: score <= 0 ? "no_tag_match" : undefined,
    });
  }

  return out
    .filter((r) => !r.excluded)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
}

export function rankHairProducts(
  input: HairRankInput,
  products: HairRankableProduct[]
): RankedScalpHairProduct<HairRankableProduct>[] {
  const out: RankedScalpHairProduct<HairRankableProduct>[] = [];
  for (const p of products) {
    const domain = catalogDomainForCategory(p.category);
    if (domain !== "hair") {
      out.push({
        product: p,
        score: 0,
        matchedTags: [],
        excluded: true,
        exclusionReason: "wrong_domain",
      });
      continue;
    }
    const matched: string[] = [];
    let score = 0;
    if (
      input.hairType &&
      input.hairType !== "unknown" &&
      p.hairTypes?.includes(input.hairType)
    ) {
      score += 1;
      matched.push(`hair_type:${input.hairType}`);
    }
    for (const c of input.hairConcerns ?? []) {
      if (c !== "unknown" && p.hairConcerns?.includes(c)) {
        score += 1;
        matched.push(`hair_concern:${c}`);
      }
    }
    if (input.colorTreated && p.hairConcerns?.includes("color_treated")) {
      score += 0.5;
      matched.push("color_treated");
    }
    out.push({
      product: p,
      score,
      matchedTags: matched,
      excluded: score <= 0,
      exclusionReason: score <= 0 ? "no_tag_match" : undefined,
    });
  }
  return out
    .filter((r) => !r.excluded)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
}

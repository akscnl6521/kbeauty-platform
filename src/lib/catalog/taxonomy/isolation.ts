/**
 * Domain isolation helpers for recommendation candidate pools.
 * Does not change face rankProducts scoring formula.
 */

import {
  beautyDomainForCategory,
  type BeautyDomain,
} from "./domains";

export function productBelongsToDomain(
  category: string | null | undefined,
  domain: BeautyDomain
): boolean {
  return beautyDomainForCategory(category) === domain;
}

export function filterCandidatesForDomain<
  T extends { category?: string | null; id?: string },
>(domain: BeautyDomain, products: T[]): T[] {
  return products.filter((p) => productBelongsToDomain(p.category, domain));
}

/** Face skincare pool — excludes sun, lip, makeup, scalp, hair, body, etc. */
export function filterFaceSkincareCandidates<
  T extends { category?: string | null },
>(products: T[]): T[] {
  return filterCandidatesForDomain("face_skincare", products);
}

export function domainMixingRisk(
  categories: Array<string | null | undefined>
): { mixed: boolean; domains: BeautyDomain[] } {
  const set = new Set<BeautyDomain>();
  for (const c of categories) {
    set.add(beautyDomainForCategory(c));
  }
  const domains = [...set];
  return { mixed: domains.length > 1, domains };
}

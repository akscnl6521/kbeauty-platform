/**
 * Makeup attribute rankers (mascara / lip / base undertone).
 * Isolation via beautyDomainForCategory — no cross-domain pool mixing.
 */

import { filterCandidatesForDomain } from "@/lib/catalog/taxonomy/isolation";
import type { BeautyDomain } from "@/lib/catalog/taxonomy/domains";

export type MakeupRankable = {
  id: string;
  category?: string | null;
  undertoneFit?: string[];
  finish?: string | null;
  coverage?: string | null;
  waterproof?: boolean | null;
  mascaraEffects?: string[];
  lipEffects?: string[];
  shadeFamily?: string | null;
};

export type MakeupRankResult<T> = {
  product: T;
  score: number;
  matchedTags: string[];
  excluded: boolean;
  exclusionReason?: string;
};

function rankInDomain<T extends MakeupRankable>(
  domain: BeautyDomain,
  products: T[],
  scoreFn: (p: T) => { score: number; matchedTags: string[] }
): MakeupRankResult<T>[] {
  const pool = new Set(filterCandidatesForDomain(domain, products));
  const out: MakeupRankResult<T>[] = [];
  for (const p of products) {
    if (!pool.has(p)) {
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
      exclusionReason: score <= 0 ? "no_match" : undefined,
    });
  }
  return out
    .filter((r) => !r.excluded)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
}

export type MascaraRankInput = {
  wantCurl?: boolean;
  wantVolume?: boolean;
  wantLongLash?: boolean;
  waterproof?: boolean;
  sensitiveEyes?: boolean;
  smudgeConcern?: boolean;
};

export function rankMascaraProducts<T extends MakeupRankable>(
  input: MascaraRankInput,
  products: T[]
): MakeupRankResult<T>[] {
  return rankInDomain("eye_makeup", products, (p) => {
    if (String(p.category ?? "").toLowerCase() !== "mascara") {
      return { score: 0, matchedTags: [] };
    }
    const effects = new Set((p.mascaraEffects ?? []).map((e) => e.toLowerCase()));
    const matched: string[] = [];
    let score = 0.2;
    if (input.wantCurl && effects.has("curl")) {
      score += 1.2;
      matched.push("curl");
    }
    if (input.wantVolume && effects.has("volume")) {
      score += 1.2;
      matched.push("volume");
    }
    if (input.wantLongLash && (effects.has("longlash") || effects.has("length"))) {
      score += 1.2;
      matched.push("longlash");
    }
    if (input.waterproof != null && p.waterproof === input.waterproof) {
      score += 1;
      matched.push(input.waterproof ? "waterproof" : "non_waterproof");
    }
    if (input.smudgeConcern && p.waterproof) {
      score += 0.6;
      matched.push("smudge_resistant_hint");
    }
    if (input.sensitiveEyes && p.waterproof) {
      score -= 0.4;
      matched.push("sensitive_eyes_caution_waterproof");
    }
    return { score, matchedTags: matched };
  });
}

export type LipRankInput = {
  undertone?: "cool" | "warm" | "neutral";
  finish?: "matte" | "glossy" | "satin";
  wantStain?: boolean;
  dryLips?: boolean;
};

export function rankLipProducts<T extends MakeupRankable>(
  input: LipRankInput,
  products: T[]
): MakeupRankResult<T>[] {
  const lipDomains: BeautyDomain[] = ["lip_color", "lip_care"];
  const results: MakeupRankResult<T>[] = [];
  for (const domain of lipDomains) {
    results.push(
      ...rankInDomain(domain, products, (p) => {
        const matched: string[] = [];
        let score = 0.15;
        const undertones = (p.undertoneFit ?? []).map((u) => u.toLowerCase());
        if (input.undertone && undertones.includes(input.undertone)) {
          score += 1.4;
          matched.push(`undertone:${input.undertone}`);
        }
        if (input.finish && p.finish === input.finish) {
          score += 1;
          matched.push(`finish:${input.finish}`);
        }
        const lips = new Set((p.lipEffects ?? []).map((e) => e.toLowerCase()));
        if (input.wantStain && lips.has("stain")) {
          score += 0.8;
          matched.push("stain");
        }
        if (input.dryLips && (p.finish === "glossy" || lips.has("hydrating"))) {
          score += 0.7;
          matched.push("dry_lips_prefer_moisture");
        }
        if (input.dryLips && p.finish === "matte") {
          score -= 0.3;
          matched.push("matte_may_emphasize_dryness");
        }
        return { score, matchedTags: matched };
      })
    );
  }
  const best = new Map<string, MakeupRankResult<T>>();
  for (const r of results) {
    const prev = best.get(r.product.id);
    if (!prev || r.score > prev.score) best.set(r.product.id, r);
  }
  return [...best.values()].sort(
    (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id)
  );
}

export type BaseMakeupExtendedInput = {
  undertone?: "cool" | "warm" | "neutral";
  coverage?: "sheer" | "medium" | "full";
  finish?: string;
};

export function rankBaseMakeupByUndertone<T extends MakeupRankable>(
  input: BaseMakeupExtendedInput,
  products: T[]
): MakeupRankResult<T>[] {
  return rankInDomain("base_makeup", products, (p) => {
    const matched: string[] = [];
    let score = 0.1;
    const undertones = (p.undertoneFit ?? []).map((u) => u.toLowerCase());
    if (input.undertone && undertones.includes(input.undertone)) {
      score += 1.5;
      matched.push(`undertone:${input.undertone}`);
    }
    if (input.coverage && p.coverage === input.coverage) {
      score += 1;
      matched.push(`coverage:${input.coverage}`);
    }
    if (input.finish && p.finish === input.finish) {
      score += 0.8;
      matched.push(`finish:${input.finish}`);
    }
    return { score, matchedTags: matched };
  });
}

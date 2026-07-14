import type { FullBeautyRawProduct } from "./generateFullBeautyCatalog";
import { beautyDomainForCategory } from "@/lib/catalog/taxonomy/domains";

export type BulkDisposition =
  | "auto_register"
  | "needs_review"
  | "duplicate"
  | "failed";

export type NormalizedBulkProduct = FullBeautyRawProduct & {
  canonicalKey: string;
  confidenceScore: number;
  disposition: BulkDisposition;
  reviewReasons: string[];
  evidenceIngredientSlugs: string[];
  evidenceConcernCodes: string[];
};

const EVIDENCE_INGREDIENT_MAP: Record<string, string> = {
  panthenol: "panthenol",
  "centella asiatica": "centella-asiatica",
  centella: "centella-asiatica",
  niacinamide: "niacinamide",
  ceramide: "ceramide",
  "hyaluronic acid": "hyaluronic-acid",
  "sodium hyaluronate": "hyaluronic-acid",
  "salicylic acid": "salicylic-acid",
  retinol: "retinol",
  adenosine: "adenosine",
  "ascorbic acid": "ascorbic-acid",
  "vitamin c": "ascorbic-acid",
  "zinc oxide": "zinc-oxide",
  "snail secretion filtrate": "snail-mucin",
  "houttuynia cordata extract": "houttuynia",
};

function slugify(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function mapEvidence(product: FullBeautyRawProduct): {
  slugs: string[];
  concerns: string[];
} {
  const slugs = new Set<string>();
  for (const ing of product.keyIngredients) {
    const key = ing.trim().toLowerCase();
    const mapped = EVIDENCE_INGREDIENT_MAP[key];
    if (mapped) slugs.add(mapped);
  }
  return { slugs: [...slugs], concerns: [...product.concerns] };
}

function scoreProduct(product: FullBeautyRawProduct): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0.25;

  if (product.curatedProvenance === "category_discovery") {
    reasons.push("discovery_placeholder");
    score = 0.2;
  }
  if (product.curatedProvenance === "known_hero" || product.curatedProvenance === "shade_variant") {
    score += 0.25;
  }

  if (product.brand && product.nameKo) score += 0.1;
  if (product.officialUrl.startsWith("https://")) score += 0.08;
  else reasons.push("official_url_not_https");

  if (product.keyIngredients.length >= 1) score += 0.1;
  else reasons.push("key_ingredients_insufficient");

  if (product.hasFullInci && product.fullIngredients.length >= 5) score += 0.15;
  else reasons.push("full_inci_incomplete");

  if (product.imageRemoteUrl) score += 0.05;
  else reasons.push("image_missing");

  if (product.category) score += 0.05;
  if (product.retailerHint && product.retailerHint !== "none") score += 0.05;
  else reasons.push("retailer_unverified");

  if (product.cautionHints.includes("official_pdp_not_confirmed")) {
    reasons.push("official_source_unconfirmed");
    score -= 0.05;
  }

  const blob = product.keyIngredients.join(" ").toLowerCase();
  if (/retinol/.test(blob) && /salicylic|glycolic|ascorbic/.test(blob)) {
    reasons.push("stimulating_actives_combined");
    score -= 0.08;
  }

  return { score: Math.max(0, Math.min(1, Number(score.toFixed(3)))), reasons };
}

export function processFullBeautyCatalog(raw: FullBeautyRawProduct[]): {
  products: NormalizedBulkProduct[];
  stats: {
    total: number;
    autoRegister: number;
    needsReview: number;
    duplicate: number;
    failed: number;
    brands: number;
    withImage: number;
    withFullInci: number;
    withRetailerHint: number;
    evidenceLinked: number;
    byDomain: Record<string, number>;
  };
} {
  const seen = new Map<string, string>();
  const products: NormalizedBulkProduct[] = [];
  let autoRegister = 0;
  let needsReview = 0;
  let duplicate = 0;
  let failed = 0;
  let evidenceLinked = 0;
  const byDomain: Record<string, number> = {};

  for (const item of raw) {
    const domain = item.domain || beautyDomainForCategory(item.category);
    byDomain[domain] = (byDomain[domain] ?? 0) + 1;

    if (!item.brand?.trim() || !item.nameKo?.trim()) {
      failed += 1;
      products.push({
        ...item,
        domain,
        canonicalKey: "",
        confidenceScore: 0,
        disposition: "failed",
        reviewReasons: ["missing_brand_or_name"],
        evidenceIngredientSlugs: [],
        evidenceConcernCodes: [],
      });
      continue;
    }

    const canonicalKey = `${slugify(item.brand)}::${slugify(item.nameEn || item.nameKo)}::${item.volumeMl ?? "na"}::${String(item.attributes.shadeCode ?? "")}`;
    if (seen.has(canonicalKey) || seen.has(item.slug)) {
      duplicate += 1;
      products.push({
        ...item,
        domain,
        canonicalKey,
        confidenceScore: 0,
        disposition: "duplicate",
        reviewReasons: ["duplicate_canonical_or_slug"],
        evidenceIngredientSlugs: [],
        evidenceConcernCodes: [],
      });
      continue;
    }
    seen.set(canonicalKey, item.slug);
    seen.set(item.slug, item.slug);

    const { score, reasons } = scoreProduct(item);
    const evidence = mapEvidence(item);
    if (evidence.slugs.length > 0) evidenceLinked += 1;

    const isDiscovery = item.curatedProvenance === "category_discovery";
    const hardBlock =
      reasons.includes("official_url_not_https") ||
      reasons.includes("stimulating_actives_combined") ||
      isDiscovery;

    let disposition: BulkDisposition = "needs_review";
    // auto_register = Staging candidate only (never public verified/published).
    // Full INCI still often missing → public Top5 remains gated separately.
    if (
      !hardBlock &&
      score >= 0.45 &&
      (item.curatedProvenance === "known_hero" ||
        item.curatedProvenance === "shade_variant")
    ) {
      disposition = "auto_register";
      autoRegister += 1;
      if (!item.hasFullInci) reasons.push("inci_pending_before_public");
    } else {
      needsReview += 1;
    }

    products.push({
      ...item,
      domain,
      canonicalKey,
      confidenceScore: score,
      disposition,
      reviewReasons: reasons,
      evidenceIngredientSlugs: evidence.slugs,
      evidenceConcernCodes: evidence.concerns,
    });
  }

  return {
    products,
    stats: {
      total: products.length,
      autoRegister,
      needsReview,
      duplicate,
      failed,
      brands: new Set(products.map((p) => p.brandId)).size,
      withImage: products.filter((p) => Boolean(p.imageRemoteUrl)).length,
      withFullInci: products.filter((p) => p.hasFullInci).length,
      withRetailerHint: products.filter(
        (p) => p.retailerHint && p.retailerHint !== "none"
      ).length,
      evidenceLinked,
      byDomain,
    },
  };
}

/** @deprecated alias */
export const processBulkKrCatalog = processFullBeautyCatalog;

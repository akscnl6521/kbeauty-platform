/**
 * Category-specific attribute extractors (mascara / lip / hair-scalp).
 * Heuristic only — never invents efficacy claims or INCI.
 */

import { beautyDomainForCategory } from "@/lib/catalog/taxonomy/domains";
import type { BeautyDomain } from "@/lib/catalog/taxonomy/domains";
import type { ParsedCatalogProduct } from "@/lib/catalog/automation/types";
import type {
  CategoryAttributesDraft,
  CategoryExtractorId,
} from "./types";

function textBlob(product: ParsedCatalogProduct): string {
  return [
    product.productNameRaw,
    product.productNameKo,
    product.productNameEn,
    product.categoryRaw,
    product.categoryCanonical,
    product.descriptionRaw,
    product.finish,
    product.shadeFamily,
    ...(product.shades ?? []).map((s) => String(s)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function resolveCategoryExtractor(
  category: string | null | undefined
): CategoryExtractorId {
  const c = String(category ?? "").toLowerCase();
  if (c === "mascara" || c.includes("mascara")) return "mascara";
  if (
    c.includes("lip") ||
    c === "tint" ||
    c === "lipstick" ||
    c === "lip_tint" ||
    c === "lip_gloss" ||
    c === "lip_balm"
  ) {
    return "lip";
  }
  if (
    c.includes("shampoo") ||
    c.includes("scalp") ||
    c.includes("conditioner") ||
    c.includes("hair")
  ) {
    return "hair_scalp";
  }
  if (c.includes("cushion") || c.includes("foundation") || c.includes("bb")) {
    return "base_makeup";
  }
  if (c.includes("serum") || c.includes("cream") || c.includes("toner")) {
    return "skincare";
  }
  if (c.includes("fragrance") || c.includes("perfume")) return "fragrance";
  if (c.includes("device") || c.includes("led")) return "device";
  if (c.includes("tool") || c.includes("brush")) return "tool";
  if (c.includes("nail")) return "nail";
  if (c.includes("body")) return "body";
  const domain = beautyDomainForCategory(category);
  if (domain === "eye_makeup") return "mascara";
  if (domain === "lip_color" || domain === "lip_care") return "lip";
  if (domain === "scalp_care" || domain === "hair_care") return "hair_scalp";
  if (domain === "base_makeup") return "base_makeup";
  if (domain === "face_skincare" || domain === "sun_care") return "skincare";
  return "unknown";
}

export function resolveDomainForExtractor(
  extractorId: CategoryExtractorId,
  category: string
): BeautyDomain {
  if (extractorId === "mascara") return "eye_makeup";
  if (extractorId === "lip") {
    return category.toLowerCase().includes("balm") ||
      category.toLowerCase().includes("care")
      ? "lip_care"
      : "lip_color";
  }
  if (extractorId === "hair_scalp") {
    return category.toLowerCase().includes("shampoo") ||
      category.toLowerCase().includes("scalp")
      ? "scalp_care"
      : "hair_care";
  }
  return beautyDomainForCategory(category);
}

export function extractCategoryAttributes(
  product: ParsedCatalogProduct
): CategoryAttributesDraft {
  const category = String(
    product.categoryCanonical || product.categoryRaw || "unknown"
  );
  const extractorId = resolveCategoryExtractor(category);
  const blob = textBlob(product);
  const rawHints: string[] = [];

  if (extractorId === "mascara") {
    const mascaraEffects: string[] = [];
    if (/curl|컬링|컬 /.test(blob)) {
      mascaraEffects.push("curl");
      rawHints.push("curl_hint");
    }
    if (/volume|볼륨/.test(blob)) {
      mascaraEffects.push("volume");
      rawHints.push("volume_hint");
    }
    if (/long\s*lash|length|롱래시|길이/.test(blob)) {
      mascaraEffects.push("longlash");
      rawHints.push("length_hint");
    }
    const waterproof =
      /waterproof|워터프루프|내수/.test(blob)
        ? true
        : /non[\s-]?waterproof|워터프루프\s*아님/.test(blob)
          ? false
          : null;
    if (waterproof != null) rawHints.push(waterproof ? "waterproof" : "non_waterproof");
    return {
      extractorId,
      mascaraEffects,
      waterproof,
      rawHints,
    };
  }

  if (extractorId === "lip") {
    const lipEffects: string[] = [];
    const undertoneFit: string[] = [];
    if (/matte|매트/.test(blob)) {
      lipEffects.push("matte");
      rawHints.push("matte");
    }
    if (/gloss|글로스|윤기/.test(blob)) {
      lipEffects.push("gloss");
      rawHints.push("gloss");
    }
    if (/stain|틴트|착색/.test(blob)) {
      lipEffects.push("stain");
      rawHints.push("stain");
    }
    if (/hydrat|moist|보습/.test(blob)) {
      lipEffects.push("hydrating");
      rawHints.push("hydrating");
    }
    if (/cool|쿨톤|핑크/.test(blob)) undertoneFit.push("cool");
    if (/warm|웜톤|코랄|오렌지/.test(blob)) undertoneFit.push("warm");
    if (/neutral|뉴트럴/.test(blob)) undertoneFit.push("neutral");
    const finish = /matte|매트/.test(blob)
      ? "matte"
      : /gloss|글로스/.test(blob)
        ? "glossy"
        : /satin|새틴/.test(blob)
          ? "satin"
          : product.finish ?? null;
    return {
      extractorId,
      lipEffects,
      undertoneFit,
      finish,
      shadeFamily: product.shadeFamily ?? null,
      rawHints,
    };
  }

  if (extractorId === "hair_scalp") {
    const scalpTypes: string[] = [];
    const scalpConcerns: string[] = [];
    if (/oily|지성|피지/.test(blob)) {
      scalpTypes.push("oily");
      scalpConcerns.push("excess_oil");
      rawHints.push("oily_scalp");
    }
    if (/dry|건성|건조/.test(blob)) {
      scalpTypes.push("dry");
      scalpConcerns.push("dryness_tightness");
      rawHints.push("dry_scalp");
    }
    if (/sensitive|민감/.test(blob)) {
      scalpTypes.push("sensitive");
      rawHints.push("sensitive_scalp");
    }
    if (/dandruff|비듬/.test(blob)) {
      scalpConcerns.push("dandruff");
      rawHints.push("dandruff");
    }
    if (/anti[\s-]?itch|가려움/.test(blob)) {
      scalpConcerns.push("itching");
      rawHints.push("itch");
    }
    const functionalClaimVerified = false;
    if (/hair\s*loss|탈모|기능성/.test(blob)) {
      rawHints.push("functional_claim_unverified");
    }
    return {
      extractorId,
      scalpTypes: scalpTypes.length ? scalpTypes : ["normal"],
      scalpConcerns,
      functionalClaimVerified,
      rawHints,
    };
  }

  return { extractorId, rawHints };
}

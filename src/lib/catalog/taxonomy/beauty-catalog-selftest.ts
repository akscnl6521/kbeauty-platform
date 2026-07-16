/**
 * Beauty taxonomy, domain isolation, media, variant selftests.
 */
import {
  assertCatalogIngestionAllowed,
  KNOWN_PRODUCTION_SUPABASE_REF,
} from "@/lib/catalog/automation/ingestionGate";
import {
  beautyDomainForCategory,
  filterFaceSkincareCandidates,
  normalizeBeautyCategory,
} from "@/lib/catalog/taxonomy";
import {
  buildProductImageAlt,
  dedupeMediaByHash,
  isTrackingOrTinyPixel,
  validateProductMediaUrl,
} from "@/lib/catalog/media/validateMedia";
import {
  colorDomainNeedsVariants,
  preserveIngredientScopes,
  validateShadeVariant,
  validateSizeVariant,
} from "@/lib/catalog/variants/variantModel";
import {
  rankBaseMakeupProducts,
  rankLipCareProducts,
  rankLipColorProducts,
  rankSunCareProducts,
} from "@/lib/catalog/domains/rankByDomain";
import { rankProducts } from "@/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "@/lib/recommend/types";
import { missingRequiredFields } from "@/lib/catalog/taxonomy/requiredFields";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[beauty-catalog-selftest] ${msg}`);
}

export function runBeautyCatalogFoundationSelftests(): {
  ok: true;
  checks: number;
} {
  let checks = 0;

  // Taxonomy separations
  assert(
    beautyDomainForCategory("sunscreen") === "sun_care",
    "sunscreen domain"
  );
  assert(
    beautyDomainForCategory("tone_up_base") === "base_makeup",
    "tone-up base"
  );
  assert(beautyDomainForCategory("lip_balm") === "lip_care", "lip balm");
  assert(beautyDomainForCategory("lipstick") === "lip_color", "lipstick");
  assert(
    beautyDomainForCategory("scalp_shampoo") === "scalp_care",
    "scalp shampoo"
  );
  assert(beautyDomainForCategory("treatment") === "hair_care", "hair treatment");
  assert(beautyDomainForCategory("cushion") === "base_makeup", "cushion");
  assert(
    beautyDomainForCategory("sun_cushion") === "sun_care",
    "sun cushion"
  );
  assert(beautyDomainForCategory("sheet_mask") === "face_skincare", "sheet mask");
  assert(beautyDomainForCategory("hair_mask") === "hair_care", "hair mask");
  assert(
    normalizeBeautyCategory("shampoo").needsReview === true,
    "ambiguous shampoo"
  );
  assert(
    normalizeBeautyCategory("hair loss shampoo").needsReview === true,
    "hair loss review"
  );
  assert(
    normalizeBeautyCategory("dry scalp shampoo").category === "dry_scalp_shampoo",
    "alias dry scalp"
  );
  assert(
    normalizeBeautyCategory("tone up").needsReview === true,
    "tone up review"
  );
  assert(normalizeBeautyCategory("mask").needsReview === true, "mask review");
  checks += 1;

  // Domain isolation for face pool
  const mixed = [
    { id: "1", category: "serum" },
    { id: "2", category: "lipstick" },
    { id: "3", category: "scalp_shampoo" },
    { id: "4", category: "sunscreen" },
    { id: "5", category: "cushion" },
    { id: "6", category: "lip_balm" },
  ];
  const faceOnly = filterFaceSkincareCandidates(mixed);
  assert(faceOnly.every((p) => p.category === "serum"), "face pool isolated");
  assert(
    !faceOnly.some((p) => p.category === "lipstick"),
    "lipstick excluded"
  );
  assert(
    !faceOnly.some((p) => p.category === "scalp_shampoo"),
    "shampoo excluded"
  );

  const sun = rankSunCareProducts({ spfMin: 30 }, [
    { id: "s1", category: "sunscreen", spfValue: 50 },
    { id: "lip", category: "lipstick", spfValue: 50 },
  ]);
  assert(sun.every((r) => r.product.id !== "lip"), "sun excludes lipstick");

  const lipCare = rankLipCareProducts({ tinted: false }, [
    { id: "lb", category: "lip_balm", tinted: false },
    { id: "ls", category: "lipstick" },
  ]);
  assert(lipCare.every((r) => r.product.id === "lb"), "lip care only");

  const lipColor = rankLipColorProducts({ shadeFamily: "coral" }, [
    { id: "lt", category: "lip_tint", shadeFamily: "coral", hasSwatch: true },
    { id: "serum", category: "serum", shadeFamily: "coral" },
  ]);
  assert(lipColor.every((r) => r.product.id === "lt"), "lip color only");

  const base = rankBaseMakeupProducts({ finish: "matte" }, [
    { id: "c", category: "cushion", finish: "matte" },
    { id: "sun", category: "sunscreen", finish: "matte" },
  ]);
  assert(base.every((r) => r.product.id === "c"), "base excludes sunscreen");

  assert(
    beautyDomainForCategory("volume_appearance_support") ===
      "hair_loss_support",
    "hls not treatment auto"
  );
  checks += 1;

  // Media validation
  assert(
    validateProductMediaUrl("https://cdn.official.example/p.png", {
      sourceType: "official_brand",
      sourcePageUrl: "https://cdn.official.example/product/1",
    }).ok,
    "official https ok"
  );
  assert(
    !validateProductMediaUrl("http://cdn.official.example/p.png", {
      sourceType: "official_brand",
    }).ok,
    "http blocked"
  );
  assert(
    validateProductMediaUrl("https://127.0.0.1/x.png", {
      sourceType: "official_brand",
    }).status === "prohibited",
    "private ip"
  );
  assert(
    validateProductMediaUrl("https://user:pass@cdn.example/x.png", {
      sourceType: "official_brand",
    }).status === "prohibited",
    "credentials"
  );
  assert(
    validateProductMediaUrl("https://cdn.example/tracking/pixel.gif", {
      sourceType: "official_brand",
    }).status === "needs_review",
    "tracking"
  );
  assert(
    validateProductMediaUrl("https://images.google.com/x.png", {
      sourceType: "search_engine",
    }).status === "prohibited",
    "search engine"
  );
  assert(
    validateProductMediaUrl("https://cdn.example/ai.png", {
      sourceType: "ai_generated",
    }).status === "prohibited",
    "ai image"
  );
  assert(isTrackingOrTinyPixel({ width: 1, height: 1 }), "1x1");
  assert(
    dedupeMediaByHash([
      { imageUrl: "a", contentHash: "h1" },
      { imageUrl: "b", contentHash: "h1" },
      { imageUrl: "c", contentHash: "h2" },
    ]).length === 2,
    "dedupe hash"
  );
  assert(
    buildProductImageAlt({
      brand: "롬앤",
      productName: "쥬시 래스팅 틴트",
      shadeName: "피그피그",
    }).includes("피그피그"),
    "alt shade"
  );
  checks += 1;

  // Variants
  const shade = validateShadeVariant({
    shadeName: "피그피그",
    hasSwatchImage: false,
    ingredientScope: "variant_specific",
  });
  assert(shade.warnings.includes("missing_swatch_image"), "swatch warn");
  const size = validateSizeVariant({ sizeValue: 30, sizeUnit: "ml" });
  assert(size.variantType === "size", "size variant");
  const scopes = preserveIngredientScopes({
    common: ["Water"],
    mayContain: ["CI 15850"],
    variantSpecific: ["Fragrance"],
  });
  assert(scopes.mergedForbidden === true, "no merge");
  assert(scopes.mayContain.includes("CI 15850"), "may contain kept");
  assert(colorDomainNeedsVariants("lip_color"), "lip needs variants");
  assert(!colorDomainNeedsVariants("face_skincare"), "skincare no shade req");
  checks += 1;

  // Required fields
  assert(
    missingRequiredFields("lipstick", {
      product_name: true,
      category: true,
      official_url: true,
      official_ingredients: true,
      shade_variants: false,
      ingredient_scope: true,
      image: true,
    }).includes("shade_variants"),
    "lipstick shade required"
  );
  assert(
    missingRequiredFields("serum", {
      product_name: true,
      category: true,
      official_url: true,
      official_ingredients: true,
      image: false,
    }).length === 0,
    "serum image recommended only"
  );
  checks += 1;

  // Staging gate still blocks shared ref
  const gate = assertCatalogIngestionAllowed({
    APP_ENV: "preview",
    CATALOG_DATABASE_ENV: "staging",
    CATALOG_INGESTION_ENABLED: "true",
    CATALOG_DRY_RUN: "true",
    SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_SUPABASE_REF,
  });
  assert(gate.status === "blocked", "shared db blocked");
  checks += 1;

  // Face rankProducts formula untouched smoke
  const rec: Recommendation = {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Glycerin"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const products: RankableProduct[] = [
    { id: "f1", category: "serum", key_ingredients: ["Glycerin"], skin_concern: ["Dryness"] },
  ];
  const ranked = rankProducts(rec, products);
  assert(ranked[0]!.score > 0, "face rank intact");
  // Mixing guard: callers must filter first
  const polluted = rankProducts(rec, [
    ...products,
    { id: "bad", category: "lipstick", key_ingredients: ["Glycerin"] },
  ]);
  // Formula still scores lipstick if passed — isolation is caller's job via filter
  assert(
    filterFaceSkincareCandidates([
      { id: "f1", category: "serum" },
      { id: "bad", category: "lipstick" },
    ]).length === 1,
    "filter before rank"
  );
  assert(polluted.length >= 1, "rankProducts still runs");
  checks += 1;

  return { ok: true, checks };
}

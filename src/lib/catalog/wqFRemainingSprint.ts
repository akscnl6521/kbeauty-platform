/**
 * WQ-F catalog remaining sprint orchestrator.
 * Crawl → normalize → quality gate → dry-run → optional Staging candidate upsert.
 * Never auto-publishes products.
 */

import {
  buildCatalogExceptionQueue,
  type CatalogExceptionInput,
  type CatalogExceptionQueueItem,
} from "@/lib/catalog/automation/exceptionQueue";
import {
  KR_BRAND_SEED_REGISTRY,
  type KrBrandSeedEntry,
} from "@/lib/catalog/bulkKr/brandRegistry";
import {
  discoverOfficialProductUrls,
  extractOfficialProductFromUrl,
  selectPopularKrBrands,
  sleepForRateLimit,
  type ExtractedOfficialProduct,
  type OfficialCrawlDiscovery,
} from "@/lib/catalog/officialCrawl";
import {
  classifyCatalogQualityStatus,
  computeCatalogQualityRates,
  countByQualityStatus,
  type CatalogQualityStatus,
} from "@/lib/catalog/qualityStatus";

export type WqfSprintOptions = {
  maxBrands?: number;
  maxProductsPerBrand?: number;
  existingUrls?: Set<string>;
  brandIds?: string[];
};

export type WqfProductResult = {
  brandId: string;
  brand: string;
  url: string;
  externalProductId: string;
  productName: string | null;
  qualityStatus: CatalogQualityStatus;
  ok: boolean;
  duplicate: boolean;
  hasIngredients: boolean;
  hasImage: boolean;
  hasOffer: boolean;
  hasMojibake: boolean;
  reasons: string[];
  extracted: ExtractedOfficialProduct | null;
};

export type WqfBrandResult = {
  discovery: OfficialCrawlDiscovery;
  products: WqfProductResult[];
  rateLimitPerMinute: number;
};

export type WqfSprintResult = {
  generatedAt: string;
  brands: WqfBrandResult[];
  products: WqfProductResult[];
  counts: {
    brandsCrawled: number;
    productsAttempted: number;
    success: number;
    fail: number;
    duplicate: number;
    review: number;
    stagingReady: number;
  };
  rates: ReturnType<typeof computeCatalogQualityRates>;
  statusCounts: Record<CatalogQualityStatus, number>;
  exceptionQueue: CatalogExceptionQueueItem[];
  dryRunCandidates: Array<{
    externalProductId: string;
    brand: string;
    productName: string;
    url: string;
    qualityStatus: CatalogQualityStatus;
    workflowStatus: "discovered" | "needs_review";
  }>;
};

function slugPart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildExternalProductId(brandId: string, url: string): string {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep raw */
  }
  return `wqf:${brandId}:${slugPart(path) || "product"}`;
}

export function classifyExtractedProduct(input: {
  brandId: string;
  brand: string;
  discovery: OfficialCrawlDiscovery;
  extracted: ExtractedOfficialProduct | null;
  url: string;
  existingUrls: Set<string>;
  seenInRun: Set<string>;
}): WqfProductResult {
  const { discovery, extracted, url } = input;
  const reasons: string[] = [...discovery.reasons];
  const externalProductId = buildExternalProductId(input.brandId, url);
  const normalizedUrl = (() => {
    try {
      return new URL(url).href;
    } catch {
      return url;
    }
  })();

  const duplicate =
    input.existingUrls.has(normalizedUrl) ||
    input.seenInRun.has(normalizedUrl) ||
    (extracted?.url
      ? input.existingUrls.has(extracted.url) || input.seenInRun.has(extracted.url)
      : false);

  if (!extracted || !extracted.ok) {
    const code = extracted?.code ?? "EXTRACT_FAILED";
    reasons.push(code);
    const discontinued = code === "HTTP_404";
    const unavailable = code === "HTTP_ERROR" || code === "FETCH_FAILED";
    const blockedByPolicy =
      code === "CAPTCHA" || discovery.blocked || !discovery.robotsAllowed;
    const qualityStatus = classifyCatalogQualityStatus({
      blockedByPolicy,
      isDuplicate: duplicate,
      discontinued,
      unavailable,
      sourceVerified: false,
      hasIngredients: false,
      hasImage: false,
      hasOffer: false,
      needsReview: true,
      reasons,
    });
    return {
      brandId: input.brandId,
      brand: input.brand,
      url: normalizedUrl,
      externalProductId,
      productName: extracted?.productName ?? null,
      qualityStatus,
      ok: false,
      duplicate,
      hasIngredients: false,
      hasImage: false,
      hasOffer: false,
      hasMojibake: Boolean(extracted?.hasMojibake),
      reasons,
      extracted,
    };
  }

  if (extracted.hasMojibake) reasons.push("mojibake_detected");
  if (!discovery.robotsAllowed) reasons.push("robots_not_allowed");
  if (discovery.blocked) reasons.push("crawl_blocked");
  if (duplicate) reasons.push("duplicate_url");

  const titleOk = Boolean(
    extracted.productName &&
      extracted.productName.trim().length >= 3 &&
      !/전체상품|공식몰|공식 홈|official store|all products/i.test(extracted.productName)
  );
  if (!titleOk) reasons.push("weak_product_title");

  const hasIngredients = extracted.ingredients.length >= 3;
  const hasImage = Boolean(extracted.imageUrl);
  const hasOffer =
    typeof extracted.price === "number" &&
    extracted.price > 0 &&
    Boolean(extracted.currency);
  const sourceVerified =
    discovery.robotsAllowed &&
    !discovery.blocked &&
    Boolean(discovery.origin) &&
    !extracted.hasMojibake &&
    titleOk;

  const qualityStatus = classifyCatalogQualityStatus({
    blockedByPolicy: discovery.blocked || !discovery.robotsAllowed,
    isDuplicate: duplicate,
    discontinued: false,
    unavailable: false,
    sourceVerified,
    hasIngredients: titleOk ? hasIngredients : false,
    hasImage: titleOk ? hasImage : false,
    hasOffer: titleOk ? hasOffer : false,
    needsReview:
      !titleOk ||
      !hasIngredients ||
      !hasImage ||
      !sourceVerified ||
      extracted.hasMojibake,
    reasons,
  });

  return {
    brandId: input.brandId,
    brand: input.brand,
    url: extracted.url || normalizedUrl,
    externalProductId,
    productName: extracted.productName,
    qualityStatus,
    ok: titleOk,
    duplicate,
    hasIngredients: titleOk && hasIngredients,
    hasImage: titleOk && hasImage,
    hasOffer: titleOk && hasOffer,
    hasMojibake: extracted.hasMojibake,
    reasons,
    extracted,
  };
}

export function buildExceptionInputsFromProducts(
  products: WqfProductResult[]
): CatalogExceptionInput[] {
  const out: CatalogExceptionInput[] = [];
  for (const p of products) {
    if (p.qualityStatus === "staging_ready") continue;
    const base = {
      externalProductId: p.externalProductId,
      brand: p.brand,
      productName: p.productName ?? "(unnamed)",
      sourceUrl: p.url,
      reasons: p.reasons,
    };
    if (p.qualityStatus === "duplicate" || p.duplicate) {
      out.push({ ...base, kind: "duplicate", confidence: 0.95 });
    }
    if (p.qualityStatus === "source_unverified" || p.qualityStatus === "blocked_by_policy") {
      out.push({ ...base, kind: "source_mismatch" });
    }
    if (!p.ok || p.qualityStatus === "unavailable") {
      out.push({ ...base, kind: "fetch_failed" });
    }
    if (p.qualityStatus === "ingredient_incomplete" || !p.hasIngredients) {
      out.push({ ...base, kind: "missing_inci" });
    }
    if (p.qualityStatus === "image_missing" || !p.hasImage) {
      out.push({ ...base, kind: "missing_image" });
    }
    if (p.qualityStatus === "offer_missing" || !p.hasOffer) {
      out.push({ ...base, kind: "missing_offer" });
    }
  }
  return out;
}

export function summarizeSprint(products: WqfProductResult[]): Pick<
  WqfSprintResult,
  "counts" | "rates" | "statusCounts"
> {
  const statusCounts = countByQualityStatus(products.map((p) => p.qualityStatus));
  const success = products.filter((p) => p.ok).length;
  const fail = products.length - success;
  const duplicate = products.filter((p) => p.duplicate || p.qualityStatus === "duplicate").length;
  const stagingReady = statusCounts.staging_ready;
  const review =
    products.length -
    stagingReady -
    statusCounts.duplicate -
    statusCounts.discontinued -
    statusCounts.unavailable;

  const rates = computeCatalogQualityRates({
    total: products.length,
    withIngredients: products.filter((p) => p.hasIngredients).length,
    withImage: products.filter((p) => p.hasImage).length,
    withOffer: products.filter((p) => p.hasOffer).length,
    stagingReady,
    duplicate,
    reviewOrBlocked: products.filter((p) => p.qualityStatus !== "staging_ready").length,
  });

  return {
    counts: {
      brandsCrawled: 0,
      productsAttempted: products.length,
      success,
      fail,
      duplicate,
      review: Math.max(0, review),
      stagingReady,
    },
    rates,
    statusCounts,
  };
}

export async function runWqfCatalogRemainingSprint(
  options: WqfSprintOptions = {}
): Promise<WqfSprintResult> {
  const maxBrands = Math.max(1, Math.min(12, options.maxBrands ?? 5));
  const maxProductsPerBrand = Math.max(
    1,
    Math.min(20, options.maxProductsPerBrand ?? 10)
  );
  const existingUrls = options.existingUrls ?? new Set<string>();
  const seenInRun = new Set<string>();

  let brands: KrBrandSeedEntry[] = selectPopularKrBrands(maxBrands);
  if (options.brandIds?.length) {
    const want = new Set(options.brandIds);
    // Search the full registry, not just the top-N popular slice, so an
    // explicitly requested brandId is never silently dropped.
    brands = KR_BRAND_SEED_REGISTRY.filter((b) => want.has(b.brandId)).slice(
      0,
      maxBrands
    );
  }

  const brandResults: WqfBrandResult[] = [];
  const allProducts: WqfProductResult[] = [];

  for (const brand of brands) {
    const discovery = await discoverOfficialProductUrls(brand, {
      maxProductUrls: maxProductsPerBrand,
      maxPages: 36,
    });

    const products: WqfProductResult[] = [];
    for (const url of discovery.productUrls) {
      let extracted: ExtractedOfficialProduct | null =
        (discovery.extractedProducts ?? []).find((p) => p.url === url) ?? null;
      if (!extracted) {
        await sleepForRateLimit(brand.rateLimitPerMinute);
        try {
          extracted = await extractOfficialProductFromUrl(url, {
            fallbackBrand: brand.canonicalBrand,
          });
        } catch (error) {
          extracted = {
            ok: false,
            url,
            brandName: brand.canonicalBrand,
            productName: null,
            imageUrl: null,
            ingredients: [],
            ingredientsRaw: null,
            price: null,
            currency: null,
            availability: null,
            description: null,
            category: null,
            hasMojibake: false,
            code: "EXCEPTION",
            message: error instanceof Error ? error.message : "unknown",
          };
        }
      }

      const result = classifyExtractedProduct({
        brandId: brand.brandId,
        brand: brand.canonicalBrand,
        discovery,
        extracted,
        url,
        existingUrls,
        seenInRun,
      });
      seenInRun.add(result.url);
      products.push(result);
      allProducts.push(result);
    }

    // Brand with zero URLs still recorded for summary.
    if (!discovery.productUrls.length) {
      const placeholderUrl = discovery.origin ?? `https://missing.local/${brand.brandId}`;
      const result = classifyExtractedProduct({
        brandId: brand.brandId,
        brand: brand.canonicalBrand,
        discovery,
        extracted: {
          ok: false,
          url: placeholderUrl,
          brandName: brand.canonicalBrand,
          productName: null,
          imageUrl: null,
          ingredients: [],
          ingredientsRaw: null,
          price: null,
          currency: null,
          availability: null,
          description: null,
          category: null,
          hasMojibake: false,
          code: "NO_PRODUCT_URLS",
          message: "no_product_urls",
        },
        url: placeholderUrl,
        existingUrls,
        seenInRun,
      });
      products.push(result);
      allProducts.push(result);
    }

    brandResults.push({
      discovery,
      products,
      rateLimitPerMinute: brand.rateLimitPerMinute,
    });
  }

  const summary = summarizeSprint(allProducts);
  summary.counts.brandsCrawled = brandResults.length;

  const exceptionQueue = buildCatalogExceptionQueue(
    buildExceptionInputsFromProducts(allProducts)
  );

  const dryRunCandidates = allProducts
    .filter((p) => p.ok && !p.duplicate)
    .map((p) => ({
      externalProductId: p.externalProductId,
      brand: p.brand,
      productName: p.productName ?? "(unnamed)",
      url: p.url,
      qualityStatus: p.qualityStatus,
      workflowStatus:
        p.qualityStatus === "staging_ready"
          ? ("discovered" as const)
          : ("needs_review" as const),
    }));

  return {
    generatedAt: new Date().toISOString(),
    brands: brandResults,
    products: allProducts,
    counts: summary.counts,
    rates: summary.rates,
    statusCounts: summary.statusCounts,
    exceptionQueue,
    dryRunCandidates,
  };
}

/**
 * Dry-run catalog automation orchestrator.
 * Stages in-memory / optional DB writes. Never auto-promotes to products.
 */

import { getConnectorForSource } from "./connectors";
import {
  buildFixtureDocument,
} from "./jsonLdParser";
import {
  DEFAULT_AUTOMATION_CONFIG,
  type CatalogSourceRecord,
  type AutomationRuntimeConfig,
  type ParsedCatalogOffer,
  type ParsedCatalogProduct,
  type ParsedIngredientSource,
} from "./types";
import { validateStagingOffer, validateStagingProduct } from "./validators";

export type DryRunProductResult = {
  sourceName: string;
  category: string | null;
  brand: string;
  productName: string;
  productVerified: boolean;
  ingredientsFound: boolean;
  offersFound: number;
  staged: boolean;
  needsReview: boolean;
  rejected: boolean;
  authorizationBlocked: boolean;
  /** Dry-run fixtures are never real catalog rows. */
  isFixture: boolean;
  errors: string[];
  product?: ParsedCatalogProduct;
  ingredients?: ParsedIngredientSource | null;
  offers?: ParsedCatalogOffer[];
};

export type DryRunSummary = {
  config: AutomationRuntimeConfig;
  generatedAt: string;
  sources: Array<{
    name: string;
    authorization: string;
    automationAllowed: boolean;
    permissionStatus: string;
    nextAction?: string;
  }>;
  products: DryRunProductResult[];
  totals: {
    discovered: number;
    fixtureDiscovered: number;
    realDiscovered: number;
    productVerified: number;
    ingredientsFound: number;
    offersFound: number;
    coupangOfferCandidates: number;
    oliveYoungOfferCandidates: number;
    brandStoreOffers: number;
    staged: number;
    needsReview: number;
    rejected: number;
    authorizationRequiredSources: number;
  };
};

export function loadAutomationConfig(
  env: NodeJS.ProcessEnv = process.env
): AutomationRuntimeConfig {
  return {
    dryRun: env.CATALOG_DRY_RUN !== "false",
    autoPromote: env.CATALOG_AUTO_PROMOTE === "true",
    maxProductsPerSource: Number(env.MAX_PRODUCTS_PER_SOURCE ?? 20) || 20,
    maxProductsTotal: Number(env.MAX_PRODUCTS_TOTAL ?? 50) || 50,
    cronEnabled: env.CATALOG_CRON_ENABLED === "true",
  };
}

export const DRY_RUN_FIXTURES = [
  buildFixtureDocument({
    url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    json: {
      "@type": "Product",
      name: "Advanced Snail 96 Mucin Power Essence",
      brand: { "@type": "Brand", name: "COSRX" },
      category: "serum",
      size: "100 ml",
      image: "https://www.cosrx.co.kr/images/essence-96.png",
      url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
      ingredients:
        "Snail Secretion Filtrate, Water, Butylene Glycol, Glycerin, Niacinamide, Sodium Hyaluronate, Panthenol",
      offers: {
        "@type": "Offer",
        price: "23000",
        priceCurrency: "KRW",
        availability: "https://schema.org/InStock",
        url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
        seller: { "@type": "Organization", name: "COSRX Official KR" },
      },
    },
  }),
  buildFixtureDocument({
    url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
    json: {
      "@type": "Product",
      name: "Advanced Snail 92 All in One Cream",
      brand: { "@type": "Brand", name: "COSRX" },
      category: "cream",
      size: "100 g",
      image: "https://www.cosrx.co.kr/images/cream-92.png",
      url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
      ingredients:
        "Snail Secretion Filtrate, Water, Glycerin, Butylene Glycol, Cetearyl Alcohol",
      offers: {
        "@type": "Offer",
        price: 23000,
        priceCurrency: "KRW",
        availability: "https://schema.org/InStock",
        url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
        seller: { "@type": "Organization", name: "COSRX Official KR" },
      },
    },
  }),
  buildFixtureDocument({
    url: "https://world.openbeautyfacts.org/product/fixture-sunscreen-spf50",
    json: {
      "@type": "Product",
      name: "Fixture Sunscreen SPF50 PA++++",
      brand: { "@type": "Brand", name: "Fixture Brand" },
      category: "sunscreen",
      description: "SPF50 PA++++ broad spectrum",
      ingredients: "Aqua, Zinc Oxide, Titanium Dioxide, Glycerin",
      offers: {
        "@type": "Offer",
        price: "18.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://world.openbeautyfacts.org/product/fixture-sunscreen-spf50",
      },
    },
  }),
  buildFixtureDocument({
    url: "https://example-official.test/products/lip-balm-clear",
    json: {
      "@type": "Product",
      name: "Fixture Lip Balm Clear",
      brand: { "@type": "Brand", name: "Fixture Brand" },
      category: "lip_balm",
      ingredients: "Ricinus Communis Seed Oil, Beeswax, Mentha Piperita Oil",
      offers: {
        "@type": "Offer",
        price: "9000",
        priceCurrency: "KRW",
        availability: "https://schema.org/InStock",
        url: "https://example-official.test/products/lip-balm-clear",
        seller: { "@type": "Organization", name: "Fixture Official" },
      },
    },
  }),
  buildFixtureDocument({
    url: "https://example-official.test/products/lipstick-rose-01",
    json: {
      "@type": "Product",
      name: "Fixture Lipstick Rose 01",
      brand: { "@type": "Brand", name: "Fixture Brand" },
      category: "lipstick",
      color: "Rose 01",
      ingredients: "Ricinus Communis Seed Oil, CI 15850, CI 77491, Parfum",
      offers: {
        "@type": "Offer",
        price: "22000",
        priceCurrency: "KRW",
        availability: "https://schema.org/OutOfStock",
        url: "https://example-official.test/products/lipstick-rose-01",
      },
    },
  }),
];

const DEFAULT_SOURCES: CatalogSourceRecord[] = [
  {
    id: "src-coupang",
    name: "Coupang Partners",
    sourceType: "retailer",
    sourceTier: 2,
    baseUrl: "https://www.coupang.com",
    countryCode: "KR",
    languageCode: "ko",
    retailerType: "marketplace",
    isOfficialBrandSource: false,
    isAuthorizedRetailer: false,
    automationAllowed: false,
    authorizationStatus: "api_credentials_required",
    robotsStatus: "unknown",
    termsStatus: "unknown",
    parserType: "coupang_authorized",
    rateLimitPerMinute: 6,
    isActive: true,
  },
  {
    id: "src-oy",
    name: "Olive Young KR",
    sourceType: "retailer",
    sourceTier: 2,
    baseUrl: "https://www.oliveyoung.co.kr",
    countryCode: "KR",
    languageCode: "ko",
    retailerType: "authorized_retailer",
    isOfficialBrandSource: false,
    isAuthorizedRetailer: true,
    automationAllowed: false,
    authorizationStatus: "manual_review",
    robotsStatus: "unknown",
    termsStatus: "unknown",
    parserType: "oliveyoung_approved",
    rateLimitPerMinute: 6,
    isActive: true,
  },
  {
    id: "src-cosrx",
    name: "COSRX Official KR",
    sourceType: "brand_official",
    sourceTier: 1,
    baseUrl: "https://www.cosrx.co.kr",
    countryCode: "KR",
    languageCode: "ko",
    retailerType: "brand_store",
    isOfficialBrandSource: true,
    isAuthorizedRetailer: true,
    automationAllowed: false,
    authorizationStatus: "manual_review",
    robotsStatus: "unknown",
    termsStatus: "unknown",
    parserType: "brand_official",
    rateLimitPerMinute: 6,
    isActive: true,
  },
  {
    id: "src-obf",
    name: "Open Beauty Facts",
    sourceType: "open_data",
    sourceTier: 3,
    baseUrl: "https://world.openbeautyfacts.org",
    countryCode: null,
    languageCode: "en",
    retailerType: null,
    isOfficialBrandSource: false,
    isAuthorizedRetailer: false,
    automationAllowed: true,
    authorizationStatus: "approved",
    robotsStatus: "allowed",
    termsStatus: "allowed",
    parserType: "open_beauty_facts",
    rateLimitPerMinute: 10,
    isActive: true,
  },
  {
    id: "src-manual",
    name: "Manual Seed Fixtures",
    sourceType: "manual",
    sourceTier: 1,
    baseUrl: null,
    countryCode: "KR",
    languageCode: "ko",
    retailerType: null,
    isOfficialBrandSource: true,
    isAuthorizedRetailer: true,
    automationAllowed: true,
    authorizationStatus: "approved",
    robotsStatus: "n/a",
    termsStatus: "n/a",
    parserType: "manual_seed",
    rateLimitPerMinute: 60,
    isActive: true,
  },
];

export async function runCatalogAutomationDryRun(options?: {
  sources?: CatalogSourceRecord[];
  config?: AutomationRuntimeConfig;
}): Promise<DryRunSummary> {
  const config = options?.config ?? loadAutomationConfig();
  // Force no promotion in dry-run path
  config.autoPromote = false;
  config.dryRun = true;

  const sources = options?.sources ?? DEFAULT_SOURCES;
  const products: DryRunProductResult[] = [];
  const sourceReports: DryRunSummary["sources"] = [];
  let authRequiredSources = 0;
  let totalBudget = config.maxProductsTotal;

  for (const source of sources) {
    const connector = getConnectorForSource(source);
    const perm = await connector.canUseSource(source);
    sourceReports.push({
      name: source.name,
      authorization: source.authorizationStatus,
      automationAllowed: source.automationAllowed,
      permissionStatus: perm.status,
      nextAction: perm.ok ? undefined : perm.nextAction,
    });

    if (!perm.ok) {
      authRequiredSources += 1;
      continue;
    }

    const fixtures =
      source.parserType === "manual_seed"
        ? DRY_RUN_FIXTURES.filter((f) =>
            f.url.includes("cosrx.co.kr") || f.url.includes("example-official")
          )
        : source.parserType === "open_beauty_facts"
          ? DRY_RUN_FIXTURES.filter((f) => f.url.includes("openbeautyfacts"))
          : source.parserType === "brand_official"
            ? DRY_RUN_FIXTURES.filter((f) => f.url.includes("cosrx.co.kr"))
            : [];

    const limit = Math.min(config.maxProductsPerSource, totalBudget);
    const discovered = await connector.discoverProducts({
      source,
      dryRun: true,
      autoPromote: false,
      maxProducts: limit,
      categories: ["sunscreen", "lip_balm", "lipstick", "serum", "cream"],
      fixtures,
    });

    for (const item of discovered) {
      if (totalBudget <= 0) break;
      totalBudget -= 1;

      const fetched = await connector.fetchProduct({
        source,
        discovered: item,
        fixtures,
      });

      if ("ok" in fetched && fetched.ok === false) {
        products.push({
          sourceName: source.name,
          category: null,
          brand: item.brandRaw,
          productName: item.productNameRaw,
          productVerified: false,
          ingredientsFound: false,
          offersFound: 0,
          staged: false,
          needsReview: true,
          rejected: false,
          authorizationBlocked: true,
          isFixture: true,
          errors: [fetched.reason],
        });
        continue;
      }

      if (!("url" in fetched)) continue;

      const parsed = await connector.parseProduct(fetched);
      if (!parsed) {
        products.push({
          sourceName: source.name,
          category: null,
          brand: item.brandRaw,
          productName: item.productNameRaw,
          productVerified: false,
          ingredientsFound: false,
          offersFound: 0,
          staged: false,
          needsReview: false,
          rejected: true,
          authorizationBlocked: false,
          isFixture: true,
          errors: ["parse_failed"],
        });
        continue;
      }

      const productValidation = validateStagingProduct(parsed);
      const ingredients = await connector.parseIngredients(fetched, parsed);
      const offersRaw = await connector.parseOffers(fetched, parsed);
      const offers = offersRaw.map((o) => {
        const v = validateStagingOffer(o);
        return { ...o, _validation: v };
      });

      const needsReview =
        productValidation.status === "needs_review" ||
        offers.some((o) => o._validation.status === "needs_review") ||
        !ingredients?.tokens.length;

      // Dry-run stages in memory only — never writes products/product_offers
      // All dry-run fixture outputs are marked isFixture (not real catalog).
      products.push({
        sourceName: source.name,
        category: parsed.categoryCanonical ?? parsed.categoryRaw ?? null,
        brand: parsed.brandCanonical ?? parsed.brandRaw,
        productName: parsed.productNameRaw,
        productVerified: productValidation.status === "source_verified",
        ingredientsFound: Boolean(ingredients?.tokens.length),
        offersFound: offers.length,
        staged: config.dryRun,
        needsReview,
        rejected: productValidation.errors.includes("official_url_is_search_or_category"),
        authorizationBlocked: false,
        isFixture: true,
        errors: [
          ...productValidation.errors,
          ...offers.flatMap((o) => o._validation.errors),
        ],
        product: parsed,
        ingredients,
        offers: offers.map(({ _validation: _, ...rest }) => rest),
      });
    }
  }

  const fixtureProducts = products.filter((p) => p.isFixture);
  const realProducts = products.filter((p) => !p.isFixture);

  const totals = {
    discovered: products.length,
    fixtureDiscovered: fixtureProducts.length,
    realDiscovered: realProducts.length,
    productVerified: realProducts.filter((p) => p.productVerified).length,
    ingredientsFound: realProducts.filter((p) => p.ingredientsFound).length,
    offersFound: realProducts.reduce((n, p) => n + p.offersFound, 0),
    coupangOfferCandidates: 0,
    oliveYoungOfferCandidates: 0,
    brandStoreOffers: realProducts
      .filter((p) => p.sourceName.includes("COSRX") || p.sourceName.includes("Manual"))
      .reduce((n, p) => n + p.offersFound, 0),
    staged: realProducts.filter((p) => p.staged).length,
    needsReview: realProducts.filter((p) => p.needsReview).length,
    rejected: realProducts.filter((p) => p.rejected).length,
    authorizationRequiredSources: authRequiredSources,
  };

  return {
    config,
    generatedAt: new Date().toISOString(),
    sources: sourceReports,
    products,
    totals,
  };
}

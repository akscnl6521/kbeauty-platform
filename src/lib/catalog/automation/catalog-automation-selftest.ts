/**
 * Catalog automation selftests (fixtures only — no live retailer scrape).
 */
import { createHash } from "node:crypto";
import {
  CoupangAuthorizedConnector,
  OliveYoungApprovedConnector,
  getConnectorForSource,
} from "./connectors";
import { runCatalogAutomationDryRun } from "./dryRun";
import { parseOfficialIngredientsRaw } from "./ingredientParser";
import {
  buildFixtureDocument,
  parseJsonLdProductDocument,
} from "./jsonLdParser";
import { assertCatalogFetchUrl, evaluateSourceFetchGate } from "./sourcePolicy";
import {
  isLikelySearchOrCategoryUrl,
  parsePriceValue,
  validateStagingOffer,
  validateStagingProduct,
} from "./validators";
import type { CatalogSourceRecord } from "./types";
import {
  assessCatalogEnvironment,
  canPromoteStagingProduct,
  countRealStagingProducts,
  KNOWN_SHARED_SUPABASE_REF,
} from "./ingestionGate";
import { COLOR_MAKEUP_CATEGORIES } from "./types";
import { rankProducts } from "@/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "@/lib/recommend/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[catalog-automation-selftest] ${msg}`);
}

export async function runCatalogAutomationSelftests(): Promise<{
  ok: true;
  checks: number;
}> {
  let checks = 0;

  // Environment gate: shared DB blocks real ingest
  const blocked = assessCatalogEnvironment({
    projectRef: KNOWN_SHARED_SUPABASE_REF,
  });
  assert(blocked.previewProductionSameDb === true, "shared db detected");
  assert(blocked.realIngestionAllowed === false, "real ingest blocked");
  assert(
    !canPromoteStagingProduct({ is_fixture: true }).ok,
    "fixture promotion blocked"
  );
  assert(
    countRealStagingProducts([
      { is_fixture: true },
      { is_fixture: false },
      { is_fixture: true },
    ]).real === 1,
    "real count excludes fixtures"
  );
  checks += 1;

  // Source policy / SSRF shape
  assert(!assertCatalogFetchUrl("http://example.com/x").ok, "http blocked");
  assert(
    !assertCatalogFetchUrl("https://user:pass@example.com/x").ok,
    "url credentials blocked"
  );
  assert(
    !assertCatalogFetchUrl("https://127.0.0.1/x").ok,
    "localhost ip blocked"
  );
  assert(
    !assertCatalogFetchUrl("https://www.coupang.com/np/search?q=serum").ok,
    "search url blocked"
  );
  assert(
    evaluateSourceFetchGate({
      id: "1",
      name: "x",
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
    }).status === "authorization_required",
    "coupang auth gate"
  );
  checks += 1;

  const coupang = new CoupangAuthorizedConnector();
  const coupangPerm = await coupang.canUseSource({
    id: "c",
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
  });
  assert(!coupangPerm.ok, "coupang fetch blocked");
  const oy = new OliveYoungApprovedConnector();
  const oyPerm = await oy.canUseSource({
    id: "o",
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
  });
  assert(!oyPerm.ok, "oliveyoung fetch blocked");
  checks += 1;

  // JSON-LD product + price
  const doc = buildFixtureDocument({
    url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    json: {
      "@type": "Product",
      name: "Advanced Snail 96 Mucin Power Essence",
      brand: { name: "COSRX" },
      category: "serum",
      size: "100 ml",
      ingredients: "Water, Glycerin, Snail Secretion Filtrate, CI 77491",
      offers: {
        "@type": "Offer",
        price: "23,000",
        priceCurrency: "KRW",
        availability: "https://schema.org/InStock",
        url: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
        seller: { name: "COSRX Official KR" },
      },
    },
  });
  const product = parseJsonLdProductDocument(doc);
  assert(product?.productNameRaw.includes("Snail 96"), "jsonld name");
  assert(product?.sizeValue === 100, "jsonld size");
  assert(parsePriceValue("₩23,000") === 23000, "won price parse");
  assert(parsePriceValue(0) === 0, "zero price");
  checks += 1;

  const productVal = validateStagingProduct(product!);
  assert(productVal.status === "source_verified", "product verified");
  const offerVal = validateStagingOffer({
    retailerNameRaw: "COSRX Official KR",
    countryCode: "KR",
    currency: "KRW",
    price: 23000,
    inStock: true,
    shipsTo: ["KR"],
    purchaseUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    isOfficialStore: true,
    isAuthorizedRetailer: true,
    sourceVerified: true,
  });
  assert(offerVal.ok, "offer verified");
  assert(
    !validateStagingOffer({
      retailerNameRaw: "x",
      countryCode: "KR",
      currency: "KRW",
      price: 0,
      inStock: true,
      shipsTo: ["KR"],
      purchaseUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
      isOfficialStore: false,
      isAuthorizedRetailer: false,
      sourceVerified: true,
    }).ok,
    "price 0 invalid"
  );
  assert(
    isLikelySearchOrCategoryUrl("https://www.oliveyoung.co.kr/store/search?query=a"),
    "oy search detected"
  );
  checks += 1;

  // Ingredients
  const ing = parseOfficialIngredientsRaw({
    ingredientsRaw:
      "Aqua, Glycerin, Unknown Exotic Molecule XYZ; may contain: CI 15850",
    sourceUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    sourceType: "brand_official",
    sourceTier: 1,
    sourceVerified: true,
  });
  assert(ing.tokens.length >= 3, "tokens preserved");
  assert(
    ing.tokens.some((t) => t.ingredientRaw.includes("Unknown Exotic")),
    "unknown kept"
  );
  assert(
    ing.tokens.some((t) => t.section === "may_contain"),
    "may contain section"
  );
  assert(
    ing.tokens.find((t) => t.canonicalKey === "glycerin")?.normalizationStatus ===
      "normalized",
    "glycerin alias"
  );
  checks += 1;

  // Dry-run
  const dry = await runCatalogAutomationDryRun();
  assert(dry.config.autoPromote === false, "no auto promote");
  assert(dry.config.dryRun === true, "dry run");
  assert(dry.totals.authorizationRequiredSources >= 2, "auth sources counted");
  assert(dry.totals.discovered > 0, "discovered from fixtures");
  assert(dry.totals.fixtureDiscovered === dry.totals.discovered, "all dry-run are fixtures");
  assert(dry.totals.realDiscovered === 0, "no real products in fixture dry-run");
  assert(dry.totals.coupangOfferCandidates === 0, "no coupang offers without auth");
  checks += 1;

  // Color makeup separation smoke
  assert(COLOR_MAKEUP_CATEGORIES.has("lipstick"), "lipstick color category");
  assert(!COLOR_MAKEUP_CATEGORIES.has("serum"), "serum not color");
  checks += 1;

  // rankProducts unchanged smoke
  const rec: Recommendation = {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Glycerin"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const products: RankableProduct[] = [
    { id: "t1", key_ingredients: ["Glycerin"], skin_concern: ["Dryness"] },
  ];
  const ranked = rankProducts(rec, products);
  assert(ranked[0]!.score > 0, "rankProducts intact");
  assert(
    createHash("sha256").update("x").digest("hex").length === 64,
    "hash helper"
  );
  checks += 1;

  // Connector registry
  const manual: CatalogSourceRecord = {
    id: "m",
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
  };
  assert(getConnectorForSource(manual).id === "manual_seed", "manual connector");
  checks += 1;

  return { ok: true, checks };
}

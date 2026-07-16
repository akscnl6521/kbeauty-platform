/**
 * Permission-aware catalog connectors.
 * Coupang / Olive Young never fetch without approved automation.
 */

import { isDomainOnBrandAllowlist } from "./brandAllowlist";
import {
  buildFixtureDocument,
  parseJsonLdIngredients,
  parseJsonLdOffers,
  parseJsonLdProductDocument,
} from "./jsonLdParser";
import type {
  CatalogConnector,
  CatalogConnectorContext,
  CatalogSourceRecord,
  DiscoveredProduct,
  FetchedProductDocument,
  ParsedCatalogOffer,
  ParsedCatalogProduct,
  SourcePermissionResult,
} from "./types";
import { parseOfficialIngredientsRaw } from "./ingredientParser";

function authorizationRequired(
  reason: string,
  nextAction: string
): SourcePermissionResult {
  return {
    ok: false,
    status: "authorization_required",
    reason,
    nextAction,
  };
}

function permissionFromSource(source: CatalogSourceRecord): SourcePermissionResult {
  if (!source.isActive) {
    return {
      ok: false,
      status: "suspended",
      reason: "Source is inactive",
      nextAction: "Re-enable source after review",
    };
  }
  if (source.authorizationStatus === "prohibited") {
    return {
      ok: false,
      status: "prohibited",
      reason: "Source marked prohibited",
      nextAction: "Do not automate this source",
    };
  }
  if (source.authorizationStatus === "suspended") {
    return {
      ok: false,
      status: "suspended",
      reason: "Source suspended (rate limit / policy)",
      nextAction: "Admin review required before resume",
    };
  }
  if (
    source.authorizationStatus === "api_credentials_required" ||
    !source.automationAllowed
  ) {
    return authorizationRequired(
      `Source "${source.name}" is not approved for automation (status=${source.authorizationStatus})`,
      "Obtain partner API / terms approval, then set automation_allowed=true"
    );
  }
  if (source.robotsStatus === "disallow") {
    return {
      ok: false,
      status: "robots_disallow",
      reason: "robots.txt disallows automated fetch",
      nextAction: "Use approved API/feed only",
    };
  }
  return { ok: true, status: "allowed" };
}

abstract class BaseConnector implements CatalogConnector {
  abstract id: string;
  async canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult> {
    return permissionFromSource(source);
  }
  abstract discoverProducts(
    context: CatalogConnectorContext
  ): Promise<DiscoveredProduct[]>;
  async fetchProduct(input: {
    source: CatalogSourceRecord;
    discovered: DiscoveredProduct;
    fixtures?: FetchedProductDocument[];
  }): Promise<FetchedProductDocument | SourcePermissionResult> {
    const perm = await this.canUseSource(input.source);
    if (!perm.ok) return perm;
    const fixture = input.fixtures?.find(
      (f) =>
        f.url === input.discovered.officialProductUrl ||
        f.url === input.discovered.discoveryUrl
    );
    if (fixture) return fixture;
    return authorizationRequired(
      "Live fetch disabled in Preview; provide fixtures or approved feed",
      "Run dry-run with fixtures or enable approved automation"
    );
  }
  async parseProduct(
    document: FetchedProductDocument
  ): Promise<ParsedCatalogProduct | null> {
    return parseJsonLdProductDocument(document);
  }
  async parseIngredients(
    document: FetchedProductDocument,
    product: ParsedCatalogProduct
  ) {
    return parseJsonLdIngredients(document, product);
  }
  async parseOffers(
    document: FetchedProductDocument,
    product: ParsedCatalogProduct
  ): Promise<ParsedCatalogOffer[]> {
    return parseJsonLdOffers(document, product);
  }
}

export class CoupangAuthorizedConnector extends BaseConnector {
  id = "coupang_authorized";
  async canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult> {
    if (source.parserType !== "coupang_authorized") {
      return authorizationRequired(
        "Not a Coupang authorized source",
        "Use Coupang Partners credentials"
      );
    }
    // Never live-fetch without partner credentials env (never read secrets into logs)
    if (!process.env.COUPANG_PARTNERS_ACCESS_KEY) {
      return authorizationRequired(
        "Coupang Partners API credentials are not configured",
        "Set COUPANG_PARTNERS_ACCESS_KEY after partner approval"
      );
    }
    return permissionFromSource({
      ...source,
      automationAllowed: source.automationAllowed && source.authorizationStatus === "approved",
    });
  }
  async discoverProducts(): Promise<DiscoveredProduct[]> {
    return [];
  }
  async fetchProduct(): Promise<SourcePermissionResult> {
    return authorizationRequired(
      "Coupang live fetch blocked until Partners API is approved",
      "MANUAL_AUTHORIZATION_REQUIRED"
    );
  }
}

export class OliveYoungApprovedConnector extends BaseConnector {
  id = "oliveyoung_approved";
  async canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult> {
    if (source.parserType !== "oliveyoung_approved") {
      return authorizationRequired(
        "Not an Olive Young approved source",
        "Confirm affiliate feed or automation terms"
      );
    }
    if (source.authorizationStatus !== "approved" || !source.automationAllowed) {
      return authorizationRequired(
        "Olive Young automation not approved",
        "MANUAL_AUTHORIZATION_REQUIRED — confirm robots/terms or affiliate feed"
      );
    }
    return { ok: true, status: "allowed" };
  }
  async discoverProducts(): Promise<DiscoveredProduct[]> {
    return [];
  }
  async fetchProduct(): Promise<SourcePermissionResult> {
    return authorizationRequired(
      "Olive Young live fetch blocked until automation is approved",
      "MANUAL_AUTHORIZATION_REQUIRED"
    );
  }
}

export class BrandOfficialSiteConnector extends BaseConnector {
  id = "brand_official";
  async canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult> {
    if (!source.baseUrl) {
      return authorizationRequired("Missing base_url", "Add official domain");
    }
    try {
      const host = new URL(source.baseUrl).hostname;
      const entry = isDomainOnBrandAllowlist(host);
      if (!entry) {
        return authorizationRequired(
          "Domain not on admin-verified brand allowlist",
          "Add domain to BRAND_OFFICIAL_ALLOWLIST after manual verification"
        );
      }
      if (!entry.allowsAutomation && !source.automationAllowed) {
        return authorizationRequired(
          "Brand allowlist entry has allowsAutomation=false",
          "Review terms/robots then enable automation"
        );
      }
    } catch {
      return authorizationRequired("Invalid base_url", "Fix source base_url");
    }
    return permissionFromSource(source);
  }
  async discoverProducts(context: CatalogConnectorContext): Promise<DiscoveredProduct[]> {
    // Dry-run: only return fixture-backed discoveries
    return (context.fixtures ?? [])
      .slice(0, context.maxProducts)
      .map((f) => ({
        brandRaw: "COSRX",
        productNameRaw: "fixture",
        officialProductUrl: f.url,
        sourceTier: 1 as const,
      }));
  }
}

export class JsonLdProductConnector extends BaseConnector {
  id = "json_ld";
  async discoverProducts(context: CatalogConnectorContext): Promise<DiscoveredProduct[]> {
    return (context.fixtures ?? []).slice(0, context.maxProducts).map((f) => ({
      brandRaw: "unknown",
      productNameRaw: "jsonld",
      officialProductUrl: f.url,
      sourceTier: 1 as const,
    }));
  }
}

export class SitemapDiscoveryConnector extends BaseConnector {
  id = "sitemap_discovery";
  async discoverProducts(): Promise<DiscoveredProduct[]> {
    // Live sitemap crawl disabled in Preview automation.
    return [];
  }
  async canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult> {
    if (!source.automationAllowed) {
      return authorizationRequired(
        "Sitemap discovery requires automation_allowed",
        "Enable after robots/terms review"
      );
    }
    return permissionFromSource(source);
  }
}

export class OpenBeautyFactsConnector extends BaseConnector {
  id = "open_beauty_facts";
  async canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult> {
    if (source.parserType !== "open_beauty_facts") {
      return authorizationRequired("Wrong parser", "Use open_beauty_facts source");
    }
    return permissionFromSource(source);
  }
  async discoverProducts(context: CatalogConnectorContext): Promise<DiscoveredProduct[]> {
    return (context.fixtures ?? []).slice(0, context.maxProducts).map((f) => ({
      brandRaw: "OBF",
      productNameRaw: "obf-fixture",
      officialProductUrl: f.url,
      sourceTier: 3 as const,
    }));
  }
}

export class ManualSeedConnector extends BaseConnector {
  id = "manual_seed";
  async canUseSource(source: CatalogSourceRecord): Promise<SourcePermissionResult> {
    if (source.parserType !== "manual_seed") {
      return authorizationRequired("Wrong parser", "Use manual_seed");
    }
    return { ok: true, status: "allowed" };
  }
  async discoverProducts(context: CatalogConnectorContext): Promise<DiscoveredProduct[]> {
    return (context.fixtures ?? []).slice(0, context.maxProducts).map((f, i) => ({
      externalProductId: `manual-${i}`,
      brandRaw: "COSRX",
      productNameRaw: `manual-${i}`,
      officialProductUrl: f.url,
      sourceTier: 1 as const,
    }));
  }
  async fetchProduct(input: {
    source: CatalogSourceRecord;
    discovered: DiscoveredProduct;
    fixtures?: FetchedProductDocument[];
  }): Promise<FetchedProductDocument | SourcePermissionResult> {
    const fixture = input.fixtures?.find(
      (f) => f.url === input.discovered.officialProductUrl
    );
    if (fixture) return fixture;
    if (input.discovered.officialProductUrl) {
      return buildFixtureDocument({
        url: input.discovered.officialProductUrl,
        json: {
          "@type": "Product",
          name: input.discovered.productNameRaw,
          brand: { "@type": "Brand", name: input.discovered.brandRaw },
        },
      });
    }
    return authorizationRequired("No fixture", "Provide fixture document");
  }
}

export function getConnectorForSource(
  source: CatalogSourceRecord
): CatalogConnector {
  switch (source.parserType) {
    case "coupang_authorized":
      return new CoupangAuthorizedConnector();
    case "oliveyoung_approved":
      return new OliveYoungApprovedConnector();
    case "brand_official":
      return new BrandOfficialSiteConnector();
    case "open_beauty_facts":
      return new OpenBeautyFactsConnector();
    case "manual_seed":
      return new ManualSeedConnector();
    case "json_ld":
      return new JsonLdProductConnector();
    case "sitemap":
      return new SitemapDiscoveryConnector();
    default:
      return new JsonLdProductConnector();
  }
}

export { parseOfficialIngredientsRaw };

/**
 * CLI-safe official brand crawl (no server-only).
 * Robots-aware discovery + JSON-LD/label extraction. No CAPTCHA/login bypass.
 */

import {
  KR_BRAND_SEED_REGISTRY,
  type KrBrandSeedEntry,
} from "@/lib/catalog/bulkKr/brandRegistry";
import {
  extractLabeledIngredientsRaw,
  extractOpenGraph,
} from "@/lib/catalog/enrichment/extractLabeledIngredients";
import { parseOfficialIngredientsRaw } from "@/lib/catalog/automation/ingredientParser";
import {
  parseJsonLdIngredients,
  parseJsonLdOffers,
  parseJsonLdProductDocument,
} from "@/lib/catalog/automation/jsonLdParser";
import type { FetchedProductDocument } from "@/lib/catalog/automation/types";
import { looksLikeProductUrl } from "@/lib/pipeline/product-page";

const USER_AGENT =
  "KBeautyMatchBot/1.0 (+https://kbeauty-match.local; wq-f-catalog-remaining)";
const MAX_BYTES = 1_500_000;

const robotsDecisionCache = new Map<string, boolean>();

/**
 * Respect robots.txt without false positives.
 * Only block when User-agent:* has an exact `Disallow: /`.
 * Paths like `/admin` or `/api` must not block the whole site.
 */
async function robotsAllowsOfficialCrawl(origin: string): Promise<boolean> {
  const key = new URL(origin).origin;
  if (robotsDecisionCache.has(key)) return robotsDecisionCache.get(key)!;
  try {
    const res = await fetch(new URL("/robots.txt", key).toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      robotsDecisionCache.set(key, true);
      return true;
    }
    const text = await res.text();
    const blocks = text.split(/user-agent:\s*/i).slice(1);
    let disallowAll = false;
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      const ua = (lines[0] || "").trim().toLowerCase();
      if (ua !== "*") continue;
      for (const line of lines.slice(1)) {
        const m = line.match(/^\s*disallow:\s*(\S*)/i);
        if (!m) continue;
        if ((m[1] || "").trim() === "/") disallowAll = true;
      }
    }
    robotsDecisionCache.set(key, !disallowAll);
    return !disallowAll;
  } catch {
    robotsDecisionCache.set(key, false);
    return false;
  }
}

export const WQF_PRIORITY_BRAND_IDS = [
  "cosrx",
  "beauty-of-joseon",
  "anua",
  "round-lab",
  "isntree",
  "some-by-mi",
  "skin1004",
  "torriden",
] as const;

export type OfficialCrawlDiscovery = {
  brandId: string;
  canonicalBrand: string;
  origin: string | null;
  robotsAllowed: boolean;
  blocked: boolean;
  reasons: string[];
  productUrls: string[];
  extractedProducts: ExtractedOfficialProduct[];
  connector: string | null;
  pagesFetched: number;
};

export type ExtractedOfficialProduct = {
  ok: boolean;
  url: string;
  brandName: string | null;
  productName: string | null;
  imageUrl: string | null;
  ingredients: string[];
  ingredientsRaw: string | null;
  price: number | null;
  currency: string | null;
  availability: string | null;
  description: string | null;
  category: string | null;
  hasMojibake: boolean;
  code?: string;
  message?: string;
  httpStatus?: number;
};

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function assertPublicHttps(url: string): { ok: true; href: string } | { ok: false; message: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, message: "invalid_url" };
  }
  if (u.protocol !== "https:") return { ok: false, message: "https_required" };
  if (isPrivateOrLocalHost(u.hostname)) return { ok: false, message: "private_host" };
  return { ok: true, href: u.href };
}

async function fetchText(
  url: string,
  options?: { timeoutMs?: number; acceptJson?: boolean }
): Promise<
  | { ok: true; finalUrl: string; text: string; status: number }
  | { ok: false; message: string; status?: number }
> {
  const safe = assertPublicHttps(url);
  if (!safe.ok) return { ok: false, message: safe.message };

  try {
    const res = await fetch(safe.href, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(options?.timeoutMs ?? 10000),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: options?.acceptJson
          ? "application/json,text/plain,*/*"
          : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko,en;q=0.8",
      },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return { ok: false, message: "page_too_large", status: res.status };
    }
    return {
      ok: true,
      finalUrl: res.url || safe.href,
      text: buf.toString("utf8"),
      status: res.status,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "fetch_timeout"
        : "fetch_failed";
    return { ok: false, message };
  }
}

function extractSitemapsFromRobots(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*sitemap:\s*(\S+)/i);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}

function extractLocsFromSitemap(xml: string, max = 2000): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) && locs.length < max) {
    const loc = normalizeDiscoveredUrl(match[1]?.trim() ?? "");
    if (loc) locs.push(loc);
  }
  return locs;
}

function normalizeDiscoveredUrl(raw: string): string | null {
  if (!raw) return null;
  let value = raw
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .trim();
  if (value.startsWith("http://")) value = `https://${value.slice("http://".length)}`;
  const safe = assertPublicHttps(value);
  return safe.ok ? safe.href : null;
}

export function looksLikeMojibake(text: string | null | undefined): boolean {
  if (!text) return false;
  if (/Ã.|Â.|â€|ï¿½|Ã¢â‚¬/.test(text)) return true;
  if (/\uFFFD/.test(text)) return true;
  return false;
}

export function selectPopularKrBrands(maxBrands: number): KrBrandSeedEntry[] {
  const byId = new Map(KR_BRAND_SEED_REGISTRY.map((b) => [b.brandId, b]));
  const out: KrBrandSeedEntry[] = [];
  for (const id of WQF_PRIORITY_BRAND_IDS) {
    const entry = byId.get(id);
    if (entry) out.push(entry);
    if (out.length >= maxBrands) break;
  }
  if (out.length < maxBrands) {
    for (const entry of KR_BRAND_SEED_REGISTRY) {
      if (out.some((b) => b.brandId === entry.brandId)) continue;
      out.push(entry);
      if (out.length >= maxBrands) break;
    }
  }
  return out;
}


export function extractFromShopifyListProduct(
  product: {
    title?: string;
    handle?: string;
    vendor?: string;
    product_type?: string;
    body_html?: string;
    images?: Array<{ src?: string }>;
    variants?: Array<{ price?: string; available?: boolean }>;
  },
  origin: string,
  fallbackBrand?: string | null
): ExtractedOfficialProduct | null {
  if (!product.handle || !product.title) return null;
  const url = new URL(origin).origin + "/products/" + product.handle;
  if (!looksLikeProductUrl(url)) return null;
  const html = String(product.body_html || "");
  const labeled = extractLabeledIngredientsRaw(html);
  let ingredients: string[] = [];
  let ingredientsRaw: string | null = labeled?.raw || null;
  if (ingredientsRaw) {
    try {
      ingredients = parseOfficialIngredientsRaw({
        ingredientsRaw,
        sourceUrl: url,
        sourceType: "official_brand_page",
        sourceTier: 1,
        sourceVerified: true,
      }).tokens.map((t) => t.raw);
    } catch {
      ingredients = [];
    }
  }
  const variant = product.variants?.[0];
  const price =
    variant?.price != null && Number.isFinite(Number(variant.price))
      ? Number(variant.price)
      : null;
  return {
    ok: true,
    url,
    brandName: product.vendor?.trim() || fallbackBrand?.trim() || null,
    productName: product.title.trim(),
    imageUrl: product.images?.[0]?.src || null,
    ingredients,
    ingredientsRaw,
    price,
    currency: price != null ? "USD" : null,
    availability:
      variant?.available === true
        ? "InStock"
        : variant?.available === false
          ? "OutOfStock"
          : null,
    description: html.replace(/<[^>]+>/g, " ").slice(0, 500) || null,
    category: product.product_type || null,
    hasMojibake: looksLikeMojibake(product.title) || looksLikeMojibake(html),
  };
}

export async function sleepForRateLimit(rateLimitPerMinute: number): Promise<void> {
  const rpm = Math.max(1, rateLimitPerMinute || 6);
  const ms = Math.ceil(60_000 / rpm);
  await new Promise((r) => setTimeout(r, ms));
}

export async function discoverOfficialProductUrls(
  brand: KrBrandSeedEntry,
  options?: { maxProductUrls?: number; maxPages?: number }
): Promise<OfficialCrawlDiscovery> {
  const maxProductUrls = Math.min(30, options?.maxProductUrls ?? 10);
  const maxPages = options?.maxPages ?? 40;
  const reasons: string[] = [];
  const productUrls: string[] = [];
  const extractedProducts: ExtractedOfficialProduct[] = [];
  const sitemapUrls: string[] = [];
  let pagesFetched = 0;
  let blocked = false;
  let connector: string | null = null;

  if (!brand.officialDomains.length) {
    return {
      brandId: brand.brandId,
      canonicalBrand: brand.canonicalBrand,
      origin: null,
      robotsAllowed: false,
      blocked: true,
      reasons: ["no_official_domain"],
      productUrls: [],
      extractedProducts: [],
      connector: null,
      pagesFetched: 0,
    };
  }

  let primaryOrigin: string | null = null;
  for (const domain of brand.officialDomains) {
    const candidate = `https://${domain}`;
    pagesFetched += 1;
    const robotsOk = await robotsAllowsOfficialCrawl(candidate);
    if (robotsOk) {
      primaryOrigin = candidate;
      break;
    }
    reasons.push(`robots_blocked_or_fail:${domain}`);
  }

  if (!primaryOrigin) {
    return {
      brandId: brand.brandId,
      canonicalBrand: brand.canonicalBrand,
      origin: `https://${brand.officialDomains[0]}`,
      robotsAllowed: false,
      blocked: false,
      reasons: [...reasons, "robots_disallow_or_unavailable"],
      productUrls: [],
      extractedProducts: [],
      connector: null,
      pagesFetched,
    };
  }

  const robots = await fetchText(`${primaryOrigin}/robots.txt`, { timeoutMs: 6000 });
  pagesFetched += 1;
  if (robots.ok) {
    sitemapUrls.push(...extractSitemapsFromRobots(robots.text));
  }
  if (!sitemapUrls.length) sitemapUrls.push(`${primaryOrigin}/sitemap.xml`);

  for (const sm of [...new Set(sitemapUrls)].slice(0, 8)) {
    if (pagesFetched >= maxPages) break;
    const smSafe = assertPublicHttps(sm);
    if (!smSafe.ok) continue;
    const page = await fetchText(smSafe.href, { timeoutMs: 8000 });
    pagesFetched += 1;
    if (!page.ok) continue;
    if (/captcha|cf-challenge|attention required/i.test(page.text)) {
      blocked = true;
      reasons.push("challenge_captcha_no_bypass");
      break;
    }
    for (const loc of extractLocsFromSitemap(page.text, 2000)) {
      if (/sitemap/i.test(loc) && sitemapUrls.length < 24) sitemapUrls.push(loc);
    }
  }

  // SHOPIFY_FIRST: prefer products.json before noisy sitemaps/listings
  if (!blocked && pagesFetched < maxPages) {
    for (const domain of brand.officialDomains) {
      if (productUrls.length >= maxProductUrls || pagesFetched >= maxPages) break;
      const origin = `https://${domain.replace(/^https?:\/\//, "")}`;
      const robotsOk = await robotsAllowsOfficialCrawl(origin);
      if (!robotsOk) continue;
      const shopify = await fetchText(`${origin}/products.json?limit=50`, {
        timeoutMs: 8000,
        acceptJson: true,
      });
      pagesFetched += 1;
      if (!shopify.ok || !shopify.text.trim().startsWith("{")) continue;
      try {
        const json = JSON.parse(shopify.text) as {
          products?: Array<{ handle?: string }>;
        };
        if (!json.products?.length) continue;
        connector = "generic_shopify";
        primaryOrigin = origin;
        for (const p of json.products) {
          if (!p.handle) continue;
          const extracted = extractFromShopifyListProduct(
            p,
            origin,
            brand.canonicalBrand
          );
          if (!extracted) continue;
          productUrls.push(extracted.url);
          extractedProducts.push(extracted);
          if (productUrls.length >= maxProductUrls) break;
        }
      } catch {
        reasons.push("shopify_json_parse_failed");
      }
    }
  }

  if (!blocked && productUrls.length < maxProductUrls) {
    for (const sm of [...new Set(sitemapUrls)].slice(0, 16)) {
      if (productUrls.length >= maxProductUrls || pagesFetched >= maxPages) break;
      const smSafe = assertPublicHttps(sm);
      if (!smSafe.ok) continue;
      const page = await fetchText(smSafe.href, { timeoutMs: 8000 });
      pagesFetched += 1;
      if (!page.ok) continue;
      connector = connector ?? "generic_sitemap";
      for (const loc of extractLocsFromSitemap(page.text, 2000)) {
        if (productUrls.length >= maxProductUrls) break;
        if (looksLikeProductUrl(loc)) productUrls.push(loc);
      }
    }
  }

  if (!blocked && productUrls.length < maxProductUrls && pagesFetched < maxPages) {
    const pathHints = [
      "/",
      "/collections/all",
      "/collections/products",
      "/shop",
      "/products",
    ];
    const baseOrigin = new URL(primaryOrigin).origin;
    for (const p of pathHints) {
      if (productUrls.length >= maxProductUrls || pagesFetched >= maxPages) break;
      const page = await fetchText(`${baseOrigin}${p}`, { timeoutMs: 8000 });
      pagesFetched += 1;
      if (!page.ok) continue;
      if (/captcha|cf-challenge|attention required/i.test(page.text)) {
        blocked = true;
        reasons.push("challenge_on_listing_no_bypass");
        break;
      }
      connector = connector ?? "listing_href_scan";
      const hrefRe = /href=["']([^"']+)["']/gi;
      let hm: RegExpExecArray | null;
      while ((hm = hrefRe.exec(page.text)) && productUrls.length < maxProductUrls) {
        const raw = hm[1];
        if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
        let abs = raw;
        try {
          abs = new URL(raw, baseOrigin).href;
        } catch {
          continue;
        }
        const normalized = normalizeDiscoveredUrl(abs);
        if (!normalized) continue;
        if (!normalized.startsWith(baseOrigin.replace("http://", "https://")) &&
            !normalized.startsWith(new URL(baseOrigin).origin.replace("http://", "https://"))) {
          // keep same-host only
          try {
            if (new URL(normalized).hostname.replace(/^www\./, "") !==
                new URL(baseOrigin).hostname.replace(/^www\./, "")) continue;
          } catch {
            continue;
          }
        }
        if (looksLikeProductUrl(normalized)) productUrls.push(normalized);
      }
    }
  }

  const unique = [...new Set(productUrls)].slice(0, maxProductUrls);

  // If first domain yielded nothing, try remaining allowlisted domains once.
  if (!unique.length && !blocked) {
    for (const domain of brand.officialDomains.slice(1)) {
      const alt = `https://${domain}`;
      if (alt === primaryOrigin) continue;
      pagesFetched += 1;
      if (!(await robotsAllowsOfficialCrawl(alt))) continue;
      const shopify = await fetchText(`${alt}/products.json`, {
        timeoutMs: 6000,
        acceptJson: true,
      });
      pagesFetched += 1;
      if (shopify.ok && shopify.text.trim().startsWith("{")) {
        try {
          const json = JSON.parse(shopify.text) as {
            products?: Array<{ handle?: string }>;
          };
          for (const p of json.products ?? []) {
            if (!p.handle) continue;
            productUrls.push(`${new URL(alt).origin}/products/${p.handle}`);
            if (productUrls.length >= maxProductUrls) break;
          }
          if (productUrls.length) {
            primaryOrigin = alt;
            connector = "generic_shopify_alt_domain";
            break;
          }
        } catch {
          reasons.push(`shopify_alt_parse_failed:${domain}`);
        }
      }
    }
  }

  const finalProducts = [...new Set(productUrls)].slice(0, maxProductUrls);
  if (!finalProducts.length) reasons.push("no_product_urls");

  const extractedFinal = extractedProducts.filter((p) =>
    finalProducts.includes(p.url)
  );
  return {
    brandId: brand.brandId,
    canonicalBrand: brand.canonicalBrand,
    origin: primaryOrigin,
    robotsAllowed: true,
    blocked,
    reasons,
    productUrls: finalProducts,
    extractedProducts: extractedFinal,
    connector,
    pagesFetched,
  };
}

export async function extractOfficialProductFromUrl(
  url: string,
  options?: { fallbackBrand?: string | null }
): Promise<ExtractedOfficialProduct> {
  const base: ExtractedOfficialProduct = {
    ok: false,
    url,
    brandName: options?.fallbackBrand?.trim() || null,
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
  };

  if (!looksLikeProductUrl(url)) {
    return { ...base, code: "NOT_PRODUCT_URL", message: "not_product_url" };
  }

  // SHOPIFY_PRODUCT_JSON: richer fields when storefront exposes /products/{handle}.json
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/products\/([^\/?#]+)/i);
    if (m?.[1]) {
      const jsonUrl = u.origin + "/products/" + m[1] + ".json";
      const sj = await fetchText(jsonUrl, { timeoutMs: 10000, acceptJson: true });
      if (sj.ok && sj.text.trim().startsWith("{")) {
        const parsed = JSON.parse(sj.text) as {
          product?: {
            title?: string;
            vendor?: string;
            product_type?: string;
            body_html?: string;
            images?: Array<{ src?: string }>;
            variants?: Array<{
              price?: string;
              available?: boolean;
            }>;
          };
        };
        const product = parsed.product;
        if (product?.title) {
          const html = String(product.body_html || "");
          const labeled = extractLabeledIngredientsRaw(html);
          const fromJsonLd = parseJsonLdIngredients({
            url: jsonUrl,
            httpStatus: 200,
            fetchedAt: new Date().toISOString(),
            contentType: "text/html",
            html,
          } as FetchedProductDocument);
          const ingredientsRaw =
            labeled?.raw ||
            fromJsonLd.join(", ") ||
            null;
          const ingredients = ingredientsRaw
            ? parseOfficialIngredientsRaw({
                ingredientsRaw,
                sourceUrl: jsonUrl,
                sourceType: "official_brand_page",
                sourceTier: 1,
                sourceVerified: true,
              }).tokens.map((t) => t.raw)
            : [];
          const variant = product.variants?.[0];
          const price =
            variant?.price != null && Number.isFinite(Number(variant.price))
              ? Number(variant.price)
              : null;
          return {
            ok: true,
            url,
            brandName:
              product.vendor?.trim() ||
              options?.fallbackBrand?.trim() ||
              null,
            productName: product.title.trim(),
            imageUrl: product.images?.[0]?.src || null,
            ingredients,
            ingredientsRaw,
            price,
            currency: price != null ? "USD" : null,
            availability:
              variant?.available === true
                ? "InStock"
                : variant?.available === false
                  ? "OutOfStock"
                  : null,
            description: html.replace(/<[^>]+>/g, " ").slice(0, 500) || null,
            category: product.product_type || null,
            hasMojibake: looksLikeMojibake(product.title) || looksLikeMojibake(html),
          };
        }
      }
    }
  } catch {
    /* fall through to HTML */
  }

  const page = await fetchText(url, { timeoutMs: 12000 });
  if (!page.ok) {
    return {
      ...base,
      code: "FETCH_FAILED",
      message: page.message,
      httpStatus: page.status,
    };
  }
  if (page.status === 404) {
    return {
      ...base,
      code: "HTTP_404",
      message: "not_found",
      httpStatus: 404,
    };
  }
  if (!page.status || page.status >= 400) {
    return {
      ...base,
      code: "HTTP_ERROR",
      message: `http_${page.status}`,
      httpStatus: page.status,
    };
  }
  if (/captcha|cf-challenge|attention required/i.test(page.text)) {
    return {
      ...base,
      code: "CAPTCHA",
      message: "challenge_no_bypass",
      httpStatus: page.status,
    };
  }

  const document: FetchedProductDocument = {
    url: page.finalUrl,
    httpStatus: page.status,
    fetchedAt: new Date().toISOString(),
    contentType: "text/html",
    html: page.text,
  };

  const jsonProduct = parseJsonLdProductDocument(document);
  const og = extractOpenGraph(page.text);
  const productName =
    jsonProduct?.productNameRaw?.trim() ||
    og.title?.trim() ||
    null;
  const brandName =
    (!jsonProduct?.brandCanonical ||
    /unknown/i.test(jsonProduct.brandCanonical)
      ? null
      : jsonProduct.brandCanonical.trim()) ||
    options?.fallbackBrand?.trim() ||
    null;
  const imageUrl =
    jsonProduct?.primaryImageUrl ||
    jsonProduct?.imageUrls?.[0] ||
    og.image ||
    null;
  const description = jsonProduct?.descriptionRaw || og.description || null;
  const category = jsonProduct?.categoryCanonical || jsonProduct?.categoryRaw || null;

  const offers = jsonProduct
    ? parseJsonLdOffers(document, jsonProduct)
    : [];
  const offer = offers[0];
  const price = offer?.price ?? null;
  const currency = offer?.currency ?? null;
  const availability = offer?.availability ?? null;

  let ingredients: string[] = [];
  let ingredientsRaw: string | null = null;
  const jsonInci = jsonProduct
    ? parseJsonLdIngredients(document, jsonProduct)
    : [];
  if (jsonInci.length) {
    ingredients = jsonInci;
    ingredientsRaw = jsonInci.join(", ");
  } else {
    const labeled = extractLabeledIngredientsRaw(page.text);
    if (labeled?.raw) {
      ingredientsRaw = labeled.raw;
      ingredients = parseOfficialIngredientsRaw(labeled.raw).map((t) => t.displayName);
    }
  }

  const textProbe = [productName, brandName, description, ingredientsRaw]
    .filter(Boolean)
    .join(" ");
  const hasMojibake = looksLikeMojibake(textProbe);

  if (!productName) {
    return {
      ...base,
      brandName,
      imageUrl,
      ingredients,
      ingredientsRaw,
      price,
      currency,
      availability,
      description,
      category,
      hasMojibake,
      code: "PRODUCT_NAME_MISSING",
      message: "product_name_missing",
      httpStatus: page.status,
    };
  }

  return {
    ok: true,
    url: page.finalUrl,
    brandName,
    productName,
    imageUrl,
    ingredients,
    ingredientsRaw,
    price,
    currency,
    availability,
    description,
    category,
    hasMojibake,
    httpStatus: page.status,
  };
}

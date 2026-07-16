/**
 * JSON-LD Product parser (fixture / document based).
 */

import {
  contentHash,
  normalizeCategoryAlias,
  parsePriceValue,
  parseSpfFromText,
} from "./validators";
import type {
  FetchedProductDocument,
  ParsedCatalogOffer,
  ParsedCatalogProduct,
} from "./types";
import { parseOfficialIngredientsRaw } from "./ingredientParser";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((x): x is string => Boolean(x));
}

function extractJsonLdProducts(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const rec = asRecord(node);
        if (!rec) continue;
        const type = String(rec["@type"] ?? "");
        if (type === "Product" || type.includes("Product")) out.push(rec);
        if (type === "ItemList" && Array.isArray(rec.itemListElement)) {
          for (const item of rec.itemListElement) {
            const el = asRecord(item);
            const nested = asRecord(el?.item) ?? el;
            if (nested && String(nested["@type"] ?? "").includes("Product")) {
              out.push(nested);
            }
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return out;
}

export function parseJsonLdProductDocument(
  document: FetchedProductDocument
): ParsedCatalogProduct | null {
  const products =
    document.json && asRecord(document.json)?.["@type"]
      ? [asRecord(document.json)!]
      : document.html
        ? extractJsonLdProducts(document.html)
        : [];

  const product = products[0];
  if (!product) return null;

  const brandRec = asRecord(product.brand);
  const brandRaw =
    asString(brandRec?.name) ||
    asString(product.brand) ||
    asString(product.manufacturer) ||
    "Unknown";
  const name = asString(product.name);
  if (!name) return null;

  const images = asStringArray(product.image);
  const category =
    asString(product.category) ||
    asString(asRecord(product.category)?.name);
  const description = asString(product.description);
  const sizeText =
    asString(product.size) ||
    asString(asRecord(product.additionalProperty)?.value) ||
    "";
  const sizeMatch = sizeText.match(/(\d+(?:\.\d+)?)\s*(ml|g|oz)/i);

  return {
    brandRaw,
    brandCanonical: brandRaw,
    productNameRaw: name,
    productNameEn: name,
    categoryRaw: category,
    categoryCanonical: normalizeCategoryAlias(category) ?? undefined,
    sizeValue: sizeMatch ? Number(sizeMatch[1]) : undefined,
    sizeUnit: sizeMatch ? sizeMatch[2]!.toLowerCase() : undefined,
    descriptionRaw: description,
    spfValue: parseSpfFromText(`${name} ${description ?? ""}`) ?? undefined,
    imageUrls: images,
    primaryImageUrl: images[0],
    officialProductUrl: asString(product.url) || document.url,
    gtin: asString(product.gtin13) || asString(product.gtin),
    sku: asString(product.sku),
    sourceUrls: [document.url],
    sourceTier: 1,
  };
}

export function parseJsonLdOffers(
  document: FetchedProductDocument,
  product: ParsedCatalogProduct
): ParsedCatalogOffer[] {
  const products =
    document.json && asRecord(document.json)?.["@type"]
      ? [asRecord(document.json)!]
      : document.html
        ? extractJsonLdProducts(document.html)
        : [];
  const p = products[0];
  if (!p) return [];

  const offersRaw = p.offers;
  const offerNodes = Array.isArray(offersRaw)
    ? offersRaw
    : offersRaw
      ? [offersRaw]
      : [];

  const out: ParsedCatalogOffer[] = [];
  for (const node of offerNodes) {
    const o = asRecord(node);
    if (!o) continue;
    const price = parsePriceValue(o.price);
    const currency = asString(o.priceCurrency)?.toUpperCase();
    const url = asString(o.url) || product.officialProductUrl || document.url;
    const availability = asString(o.availability) ?? "";
    const inStock = /InStock/i.test(availability)
      ? true
      : /OutOfStock|SoldOut/i.test(availability)
        ? false
        : null;
    const seller = asRecord(o.seller);
    out.push({
      retailerNameRaw: asString(seller?.name) || "Official store",
      retailerNameCanonical: asString(seller?.name) || "Official store",
      sellerName: asString(seller?.name),
      sellerType: "retailer_direct",
      countryCode: currency === "KRW" ? "KR" : currency === "USD" ? "US" : currency === "JPY" ? "JP" : "KR",
      currency,
      price: price ?? undefined,
      displayedPrice: price ?? undefined,
      priceType: "listed",
      inStock,
      availabilityRaw: availability || undefined,
      shipsTo: currency === "KRW" ? ["KR"] : currency === "USD" ? ["US"] : currency === "JPY" ? ["JP"] : [],
      purchaseUrl: url,
      isOfficialStore: true,
      isAuthorizedRetailer: true,
      sourceVerified: true,
    });
  }
  return out;
}

export function parseJsonLdIngredients(
  document: FetchedProductDocument,
  product: ParsedCatalogProduct
): ReturnType<typeof parseOfficialIngredientsRaw> | null {
  const products =
    document.json && asRecord(document.json)?.["@type"]
      ? [asRecord(document.json)!]
      : document.html
        ? extractJsonLdProducts(document.html)
        : [];
  const p = products[0];
  if (!p) return null;
  const raw =
    asString(p.ingredients) ||
    asString((p as { ingredientList?: unknown }).ingredientList);
  if (!raw) return null;
  return parseOfficialIngredientsRaw({
    ingredientsRaw: raw,
    sourceUrl: product.officialProductUrl || document.url,
    sourceType: "json_ld",
    sourceTier: 1,
    sourceVerified: true,
  });
}

export function buildFixtureDocument(input: {
  url: string;
  html?: string;
  json?: unknown;
}): FetchedProductDocument {
  const body = input.html ?? JSON.stringify(input.json ?? {});
  return {
    url: input.url,
    httpStatus: 200,
    fetchedAt: new Date().toISOString(),
    contentType: input.html ? "text/html" : "application/ld+json",
    html: input.html,
    json: input.json,
    contentHash: contentHash(body),
    sourceMethod: "fixture",
  };
}

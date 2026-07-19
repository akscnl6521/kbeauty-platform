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

function isProductNode(rec: Record<string, unknown>): boolean {
  const type = rec["@type"];
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
  return types.some((value) => value === "Product" || value.includes("Product"));
}

function collectProductNodes(value: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectProductNodes(item, out);
    return;
  }

  const rec = asRecord(value);
  if (!rec) return;
  if (isProductNode(rec)) out.push(rec);

  if (rec["@graph"]) collectProductNodes(rec["@graph"], out);
  if (rec.itemListElement) collectProductNodes(rec.itemListElement, out);
  if (rec.item) collectProductNodes(rec.item, out);
}

function extractJsonLdProducts(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      collectProductNodes(JSON.parse(raw) as unknown, out);
    } catch {
      // Ignore invalid JSON-LD blocks. Never infer commerce data from broken JSON.
    }
  }
  return out;
}

function getProducts(document: FetchedProductDocument): Record<string, unknown>[] {
  if (document.json) {
    const out: Record<string, unknown>[] = [];
    collectProductNodes(document.json, out);
    return out;
  }
  return document.html ? extractJsonLdProducts(document.html) : [];
}

function normalizeHttpsUrl(value: unknown, fallback?: string): string | undefined {
  const raw = asString(value) ?? fallback;
  if (!raw) return undefined;
  try {
    const url = new URL(raw, fallback);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeAvailability(value: unknown): {
  raw?: string;
  inStock: boolean | null;
} {
  const raw = asString(value);
  if (!raw) return { inStock: null };
  const token = raw.toLowerCase().replace(/[^a-z가-힣]/g, "");
  if (
    token.includes("instock") ||
    token.includes("limitedavailability") ||
    token.includes("preorder") ||
    token.includes("presale") ||
    token.includes("재고있음") ||
    token.includes("판매중")
  ) {
    return { raw, inStock: true };
  }
  if (
    token.includes("outofstock") ||
    token.includes("soldout") ||
    token.includes("discontinued") ||
    token.includes("품절") ||
    token.includes("판매종료")
  ) {
    return { raw, inStock: false };
  }
  return { raw, inStock: null };
}

function inferCountry(currency?: string): string {
  if (currency === "KRW") return "KR";
  if (currency === "USD") return "US";
  if (currency === "JPY") return "JP";
  return "KR";
}

function offerRecords(raw: unknown): Record<string, unknown>[] {
  const nodes = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Record<string, unknown>[] = [];
  for (const node of nodes) {
    const record = asRecord(node);
    if (!record) continue;
    const type = String(record["@type"] ?? "");
    if (type.includes("AggregateOffer") && record.offers) {
      out.push(...offerRecords(record.offers));
      if (!out.length) out.push(record);
      continue;
    }
    out.push(record);
  }
  return out;
}

export function parseJsonLdProductDocument(
  document: FetchedProductDocument
): ParsedCatalogProduct | null {
  const product = getProducts(document)[0];
  if (!product) return null;

  const brandRec = asRecord(product.brand);
  const brandRaw =
    asString(brandRec?.name) ||
    asString(product.brand) ||
    asString(product.manufacturer) ||
    "Unknown";
  const name = asString(product.name);
  if (!name) return null;

  const images = asStringArray(product.image)
    .map((value) => normalizeHttpsUrl(value, document.url))
    .filter((value): value is string => Boolean(value));
  const category =
    asString(product.category) || asString(asRecord(product.category)?.name);
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
    imageUrls: [...new Set(images)],
    primaryImageUrl: images[0],
    officialProductUrl:
      normalizeHttpsUrl(product.url, document.url) ?? document.url,
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
  const p = getProducts(document)[0];
  if (!p) return [];

  const out: ParsedCatalogOffer[] = [];
  const seen = new Set<string>();
  for (const o of offerRecords(p.offers)) {
    const price =
      parsePriceValue(o.price) ??
      parsePriceValue(o.lowPrice) ??
      parsePriceValue(o.highPrice);
    const currency = asString(o.priceCurrency)?.toUpperCase();
    const purchaseUrl = normalizeHttpsUrl(
      o.url,
      product.officialProductUrl || document.url
    );
    if (!purchaseUrl || price == null || price <= 0 || !currency) continue;

    const availability = normalizeAvailability(o.availability);
    const seller = asRecord(o.seller);
    const retailer = asString(seller?.name) || "Official store";
    const countryCode = inferCountry(currency);
    const key = `${purchaseUrl}|${currency}|${price}|${retailer.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      externalOfferId: asString(o.sku) || asString(o["@id"]),
      retailerNameRaw: retailer,
      retailerNameCanonical: retailer,
      sellerName: asString(seller?.name),
      sellerType: "retailer_direct",
      countryCode,
      currency,
      price,
      displayedPrice: price,
      priceType: "listed",
      inStock: availability.inStock,
      availabilityRaw: availability.raw,
      shipsTo: [countryCode],
      purchaseUrl,
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
  const p = getProducts(document)[0];
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

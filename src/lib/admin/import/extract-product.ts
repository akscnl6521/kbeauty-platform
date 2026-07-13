import "server-only";

import * as cheerio from "cheerio";
import { stripControlAndHtml } from "@/lib/admin/sanitize";
import {
  canonicalizeProductUrl,
  guessCountryFromUrl,
  guessSourceTypeFromUrl,
} from "@/lib/admin/import/normalize";

export type ExtractedProductInfo = {
  productName: string | null;
  brandName: string | null;
  canonicalUrl: string | null;
  sourceUrl: string;
  sourceType: string;
  detectedCountry: string | null;
  imageUrl: string | null;
  description: string | null;
  sku: string | null;
  availability: string | null;
  price: string | null;
  currency: string | null;
  warnings: string[];
};

function cleanText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripControlAndHtml(value);
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function pickJsonLdProduct(data: unknown): Record<string, unknown> | null {
  for (const node of asArray(data)) {
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    if ("@graph" in record) {
      const found = pickJsonLdProduct(record["@graph"]);
      if (found) return found;
    }
    const type = record["@type"];
    const types = asArray(type).map((t) => String(t).toLowerCase());
    if (types.includes("product")) return record;
  }
  return null;
}

function brandFromJsonLd(product: Record<string, unknown>): string | null {
  const brand = product.brand;
  if (typeof brand === "string") return cleanText(brand, 120);
  if (brand && typeof brand === "object") {
    const b = brand as Record<string, unknown>;
    return firstString(b.name, b.brand);
  }
  return null;
}

function offerFields(product: Record<string, unknown>): {
  price: string | null;
  currency: string | null;
  availability: string | null;
  sku: string | null;
} {
  const offers = asArray(product.offers);
  const offer =
    offers.find((o) => o && typeof o === "object") as
      | Record<string, unknown>
      | undefined;
  const availabilityRaw = offer?.availability;
  let availability: string | null = null;
  if (typeof availabilityRaw === "string") {
    availability = availabilityRaw.split("/").pop() ?? availabilityRaw;
  }
  return {
    price:
      offer?.price != null
        ? cleanText(String(offer.price), 40)
        : null,
    currency: firstString(offer?.priceCurrency),
    availability: cleanText(availability, 80),
    sku: firstString(product.sku, offer?.sku),
  };
}

function nameFromUrlPath(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    const last = decodeURIComponent(parts[parts.length - 1] ?? "");
    const cleaned = last
      .replace(/\.(html?|php|aspx)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return cleaned ? cleaned.slice(0, 200) : null;
  } catch {
    return null;
  }
}

/**
 * Extract product-like fields from HTML. Never executes scripts.
 */
export function extractProductFromHtml(
  html: string,
  sourceUrl: string
): ExtractedProductInfo {
  const warnings: string[] = [];
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe").remove();

  let productName: string | null = null;
  let brandName: string | null = null;
  let imageUrl: string | null = null;
  let description: string | null = null;
  let sku: string | null = null;
  let availability: string | null = null;
  let price: string | null = null;
  let currency: string | null = null;
  let canonicalFromPage: string | null = null;

  // 1) JSON-LD Product
  $('script[type="application/ld+json"]').each((_, el) => {
    if (productName && brandName) return;
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const product = pickJsonLdProduct(parsed);
      if (!product) return;
      productName = productName ?? firstString(product.name);
      brandName = brandName ?? brandFromJsonLd(product);
      description = description ?? firstString(product.description);
      const offer = offerFields(product);
      sku = sku ?? offer.sku;
      price = price ?? offer.price;
      currency = currency ?? offer.currency;
      availability = availability ?? offer.availability;
      const image = product.image;
      if (!imageUrl) {
        if (typeof image === "string") imageUrl = cleanText(image, 2000);
        else if (Array.isArray(image) && typeof image[0] === "string") {
          imageUrl = cleanText(image[0], 2000);
        } else if (image && typeof image === "object") {
          imageUrl = firstString((image as { url?: unknown }).url);
        }
      }
    } catch {
      warnings.push("JSON-LD 파싱 실패(무시)");
    }
  });

  // 2) Open Graph / Twitter
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogUrl = $('meta[property="og:url"]').attr("content");
  const twTitle = $('meta[name="twitter:title"]').attr("content");
  productName = productName ?? firstString(ogTitle, twTitle);
  description = description ?? firstString(ogDesc);
  imageUrl = imageUrl ?? firstString(ogImage);
  canonicalFromPage = firstString(
    $('link[rel="canonical"]').attr("href"),
    ogUrl
  );

  // brand meta variants
  brandName =
    brandName ??
    firstString(
      $('meta[property="product:brand"]').attr("content"),
      $('meta[name="brand"]').attr("content"),
      $('meta[itemprop="brand"]').attr("content")
    );

  // 3) meta title / description
  productName =
    productName ??
    firstString($('meta[name="title"]').attr("content"), $("title").first().text());
  description =
    description ?? firstString($('meta[name="description"]').attr("content"));

  // 4) URL path fallback
  if (!productName) {
    productName = nameFromUrlPath(sourceUrl);
    if (productName) warnings.push("URL path에서 제품명 추정");
  }

  const absoluteCanonical = canonicalFromPage
    ? canonicalizeProductUrl(
        (() => {
          try {
            return new URL(canonicalFromPage, sourceUrl).href;
          } catch {
            return canonicalFromPage;
          }
        })()
      )
    : canonicalizeProductUrl(sourceUrl);

  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, sourceUrl).href;
      if (!imageUrl.startsWith("https://")) {
        imageUrl = null;
        warnings.push("비 https 이미지는 제외");
      }
    } catch {
      imageUrl = null;
    }
  }

  if (price || availability) {
    warnings.push("가격/재고는 참고값이며 offer로 저장되지 않습니다");
  }

  return {
    productName,
    brandName,
    canonicalUrl: absoluteCanonical,
    sourceUrl,
    sourceType: guessSourceTypeFromUrl(sourceUrl),
    detectedCountry: guessCountryFromUrl(sourceUrl),
    imageUrl,
    description: description ? description.slice(0, 500) : null,
    sku,
    availability,
    price,
    currency,
    warnings,
  };
}

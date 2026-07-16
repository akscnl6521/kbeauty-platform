/**
 * Extract offer signals from HTML (JSON-LD Offer / AggregateOffer, Shopify JSON hints).
 */

import { parseOfferPrice } from "@/lib/pipeline/offers/offer-price";
import { parseStockStatus } from "@/lib/pipeline/offers/offer-stock";

export type ExtractedOfferSignal = {
  purchaseUrl: string | null;
  priceText: string | null;
  currencyHint: string | null;
  availability: string | null;
  offerTitle: string | null;
  offerBrand: string | null;
  method: string;
  confidence: number;
  reasons: string[];
};

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function walkOffers(node: unknown, out: ExtractedOfferSignal[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) walkOffers(n, out);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const type = String(obj["@type"] ?? "");
  if (/Offer/i.test(type) || obj.price != null || obj.offers) {
    if (/AggregateOffer/i.test(type) && obj.offers) {
      walkOffers(obj.offers, out);
    }
    if (/^Offer$/i.test(type) || (obj.price != null && obj.url)) {
      const availability = firstString(obj.availability);
      const priceText = firstString(obj.price, obj.lowPrice);
      const currencyHint = firstString(obj.priceCurrency);
      const purchaseUrl = firstString(obj.url);
      out.push({
        purchaseUrl,
        priceText,
        currencyHint,
        availability,
        offerTitle: null,
        offerBrand: null,
        method: "jsonld_offer",
        confidence: 0.85,
        reasons: ["jsonld_offer"],
      });
    }
  }
  if (obj.offers) walkOffers(obj.offers, out);
  if (obj["@graph"]) walkOffers(obj["@graph"], out);
}

export function extractOffersFromHtml(
  html: string,
  pageUrl: string
): ExtractedOfferSignal[] {
  const out: ExtractedOfferSignal[] = [];
  const scripts = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (scripts) {
    for (const block of scripts) {
      const raw = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
      try {
        walkOffers(JSON.parse(raw), out);
      } catch {
        /* ignore */
      }
    }
  }

  // Shopify products.json-like blob embedded
  const shopify = html.match(
    /"offers"\s*:\s*\[\s*\{[\s\S]*?"price"\s*:\s*"?([\d.]+)"?[\s\S]*?"availability"\s*:\s*"([^"]+)"/i
  );
  if (shopify) {
    out.push({
      purchaseUrl: pageUrl,
      priceText: shopify[1] ?? null,
      currencyHint: null,
      availability: shopify[2] ?? null,
      offerTitle: null,
      offerBrand: null,
      method: "shopify_embedded",
      confidence: 0.7,
      reasons: ["shopify_embedded"],
    });
  }

  if (!out.length) {
    // Page itself as purchase URL candidate only — price unknown
    out.push({
      purchaseUrl: pageUrl,
      priceText: null,
      currencyHint: null,
      availability: null,
      offerTitle: null,
      offerBrand: null,
      method: "page_url_fallback",
      confidence: 0.35,
      reasons: ["page_url_only_no_structured_price"],
    });
  }

  // Deduplicate by url+price
  const seen = new Set<string>();
  return out.filter((o) => {
    const key = `${o.purchaseUrl}|${o.priceText}|${o.method}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarizeExtractedOffer(signal: ExtractedOfferSignal) {
  const price = parseOfferPrice({
    priceText: signal.priceText,
    currencyHint: signal.currencyHint,
  });
  const stock = parseStockStatus({ availability: signal.availability });
  return { signal, price, stock };
}

import "server-only";

import { fetchPublicHtmlPage } from "@/lib/admin/import/fetch-page";
import {
  assertSafePublicHttpsUrl,
} from "@/lib/admin/import/ssrf";
import type { BrandSeed, SiteDiscoveryResult } from "@/lib/pipeline/types";

const CONNECTORS = [
  "generic_sitemap",
  "generic_shopify",
  "generic_woocommerce",
  "generic_nextjs",
  "generic_static",
  "custom_fallback",
] as const;

function guessOfficialCandidates(brand: BrandSeed): string[] {
  if (brand.officialWebsite) return [brand.officialWebsite];
  // No invented domains — without officialWebsite we cannot auto-crawl
  return [];
}

function extractSitemapsFromRobots(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*sitemap:\s*(\S+)/i);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}

function extractLocsFromSitemap(xml: string, max = 200): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) && locs.length < max) {
    const loc = match[1]?.trim();
    if (loc) locs.push(loc);
  }
  return locs;
}

function looksLikeProductUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/(collection|collections|category|categories|blog|news|about|contact|cart|account|search)(\/|$|\?)/.test(u)) {
    return false;
  }
  return (
    /\/products?\//.test(u) ||
    /\/product\//.test(u) ||
    /\/goods\//.test(u) ||
    /\/item\//.test(u) ||
    /\/p\//.test(u)
  );
}

/**
 * Resolve official site + collect product URL candidates.
 * Does not bypass blocks/captchas. Dry-run safe (no DB writes).
 */
export async function discoverOfficialSiteAndProducts(
  brand: BrandSeed,
  options?: { maxProductUrls?: number }
): Promise<SiteDiscoveryResult> {
  const maxProductUrls = options?.maxProductUrls ?? 500;
  const candidates = guessOfficialCandidates(brand);

  if (!candidates.length) {
    return {
      brandKey: brand.brandKey,
      candidateUrl: null,
      verified: false,
      confidence: brand.confidence,
      connector: null,
      blocked: false,
      needsReview: true,
      reasons: [
        "공식 사이트 URL이 없어 자동 crawl을 시작하지 않습니다 (needs_review)",
      ],
      sitemapUrls: [],
      productUrls: [],
    };
  }

  const siteUrl = candidates[0]!;
  const safe = await assertSafePublicHttpsUrl(siteUrl);
  if (!safe.ok) {
    return {
      brandKey: brand.brandKey,
      candidateUrl: siteUrl,
      verified: false,
      confidence: 0,
      connector: null,
      blocked: false,
      needsReview: true,
      reasons: [safe.message],
      sitemapUrls: [],
      productUrls: [],
    };
  }

  const origin = new URL(safe.normalizedHref).origin;
  const reasons: string[] = [];
  let connector: string = "generic_sitemap";
  let blocked = false;
  const sitemapUrls: string[] = [];
  const productUrls: string[] = [];

  // robots.txt
  const robots = await fetchPublicHtmlPage(`${origin}/robots.txt`, {
    timeoutMs: 6000,
  });
  if (robots.ok) {
    sitemapUrls.push(...extractSitemapsFromRobots(robots.html));
  } else if (robots.code === "FETCH_FAILED") {
    // continue
  }

  if (!sitemapUrls.length) {
    sitemapUrls.push(`${origin}/sitemap.xml`);
  }

  for (const sm of sitemapUrls.slice(0, 5)) {
    const smSafe = await assertSafePublicHttpsUrl(sm);
    if (!smSafe.ok) continue;
    const page = await fetchPublicHtmlPage(smSafe.normalizedHref, {
      timeoutMs: 8000,
    });
    if (!page.ok) {
      if (page.code === "FETCH_FAILED") {
        // possible 403
        blocked = blocked || false;
      }
      continue;
    }
    if (/captcha|cf-challenge|attention required/i.test(page.html)) {
      blocked = true;
      reasons.push("challenge/captcha 감지 — 우회하지 않음");
      break;
    }
    const locs = extractLocsFromSitemap(page.html, 2000);
    // sitemap index
    for (const loc of locs) {
      if (/sitemap/i.test(loc) && sitemapUrls.length < 20) {
        sitemapUrls.push(loc);
      }
    }
  }

  // second pass product sitemaps
  for (const sm of [...new Set(sitemapUrls)].slice(0, 12)) {
    if (productUrls.length >= maxProductUrls) break;
    const smSafe = await assertSafePublicHttpsUrl(sm);
    if (!smSafe.ok) continue;
    const page = await fetchPublicHtmlPage(smSafe.normalizedHref, {
      timeoutMs: 8000,
    });
    if (!page.ok) continue;
    for (const loc of extractLocsFromSitemap(page.html, 2000)) {
      if (productUrls.length >= maxProductUrls) break;
      if (looksLikeProductUrl(loc)) productUrls.push(loc);
    }
  }

  // Shopify products.json hint
  if (productUrls.length < 5) {
    const shopify = await fetchPublicHtmlPage(`${origin}/products.json`, {
      timeoutMs: 6000,
    });
    if (shopify.ok && shopify.html.trim().startsWith("{")) {
      connector = "generic_shopify";
      try {
        const json = JSON.parse(shopify.html) as {
          products?: Array<{ handle?: string }>;
        };
        for (const p of json.products ?? []) {
          if (!p.handle) continue;
          productUrls.push(`${origin}/products/${p.handle}`);
          if (productUrls.length >= maxProductUrls) break;
        }
      } catch {
        reasons.push("Shopify JSON 파싱 실패");
      }
    }
  }

  const uniqueProducts = [...new Set(productUrls)].slice(0, maxProductUrls);
  const verified = Boolean(brand.officialWebsite) && !blocked;
  const needsReview = blocked || !verified || uniqueProducts.length === 0;

  if (!uniqueProducts.length) {
    reasons.push("제품 URL을 충분히 수집하지 못함");
  }
  if (verified) reasons.push("brands/products 출처 공식 URL 사용");

  return {
    brandKey: brand.brandKey,
    candidateUrl: origin,
    verified,
    confidence: verified ? Math.max(brand.confidence, 0.75) : brand.confidence,
    connector: CONNECTORS.includes(connector as never)
      ? connector
      : "custom_fallback",
    blocked,
    needsReview,
    reasons,
    sitemapUrls: [...new Set(sitemapUrls)].slice(0, 30),
    productUrls: uniqueProducts,
  };
}

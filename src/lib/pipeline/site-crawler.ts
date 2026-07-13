import "server-only";

import { fetchPublicHtmlPage } from "@/lib/admin/import/fetch-page";
import { assertSafePublicHttpsUrl } from "@/lib/admin/import/ssrf";
import { resolveOfficialSite } from "@/lib/pipeline/official-site-resolver";
import { looksLikeProductUrl } from "@/lib/pipeline/product-page";
import type { BrandSeed, SiteDiscoveryResult } from "@/lib/pipeline/types";

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

/**
 * Resolve official site (improved) + collect product URLs when crawl allowed.
 */
export async function discoverOfficialSiteAndProducts(
  brand: BrandSeed,
  options?: { maxProductUrls?: number; maxPages?: number }
): Promise<SiteDiscoveryResult> {
  const maxProductUrls = Math.min(50, options?.maxProductUrls ?? 50);
  const maxPages = options?.maxPages ?? 200;

  const resolution = await resolveOfficialSite(brand);

  if (!resolution.allowCrawl || !resolution.selectedUrl) {
    return {
      brandKey: brand.brandKey,
      candidateUrl: resolution.selectedUrl,
      verified: resolution.classification === "verified_official",
      confidence: resolution.confidence,
      connector: null,
      blocked: resolution.classification === "blocked",
      needsReview: true,
      reasons: [
        ...resolution.reasons,
        resolution.allowCrawl
          ? "crawl 허용이나 URL 없음"
          : `자동 crawl 비허용 (${resolution.classification})`,
      ],
      sitemapUrls: [],
      productUrls: [],
      resolution: {
        classification: resolution.classification,
        confidence: resolution.confidence,
        allowCrawl: resolution.allowCrawl,
        selectedUrl: resolution.selectedUrl,
        reasons: resolution.reasons,
      },
    };
  }

  const safe = await assertSafePublicHttpsUrl(resolution.selectedUrl);
  if (!safe.ok) {
    return {
      brandKey: brand.brandKey,
      candidateUrl: resolution.selectedUrl,
      verified: false,
      confidence: 0,
      connector: null,
      blocked: false,
      needsReview: true,
      reasons: [safe.message],
      sitemapUrls: [],
      productUrls: [],
      resolution: {
        classification: resolution.classification,
        confidence: resolution.confidence,
        allowCrawl: false,
        selectedUrl: resolution.selectedUrl,
        reasons: resolution.reasons,
      },
    };
  }

  const origin = new URL(safe.normalizedHref).origin;
  const reasons = [...resolution.reasons];
  let connector = "generic_sitemap";
  let blocked = false;
  const sitemapUrls: string[] = [];
  const productUrls: string[] = [];
  let pagesFetched = 0;

  const robots = await fetchPublicHtmlPage(`${origin}/robots.txt`, {
    timeoutMs: 6000,
  });
  pagesFetched += 1;
  if (robots.ok) {
    sitemapUrls.push(...extractSitemapsFromRobots(robots.html));
  }
  if (!sitemapUrls.length) sitemapUrls.push(`${origin}/sitemap.xml`);

  for (const sm of [...new Set(sitemapUrls)].slice(0, 8)) {
    if (pagesFetched >= maxPages) break;
    const smSafe = await assertSafePublicHttpsUrl(sm);
    if (!smSafe.ok) continue;
    const page = await fetchPublicHtmlPage(smSafe.normalizedHref, {
      timeoutMs: 8000,
    });
    pagesFetched += 1;
    if (!page.ok) continue;
    if (/captcha|cf-challenge|attention required/i.test(page.html)) {
      blocked = true;
      reasons.push("challenge/captcha — 우회 안 함");
      break;
    }
    for (const loc of extractLocsFromSitemap(page.html, 2000)) {
      if (/sitemap/i.test(loc) && sitemapUrls.length < 24) sitemapUrls.push(loc);
    }
  }

  for (const sm of [...new Set(sitemapUrls)].slice(0, 16)) {
    if (productUrls.length >= maxProductUrls || pagesFetched >= maxPages) break;
    const smSafe = await assertSafePublicHttpsUrl(sm);
    if (!smSafe.ok) continue;
    const page = await fetchPublicHtmlPage(smSafe.normalizedHref, {
      timeoutMs: 8000,
    });
    pagesFetched += 1;
    if (!page.ok) continue;
    for (const loc of extractLocsFromSitemap(page.html, 2000)) {
      if (productUrls.length >= maxProductUrls) break;
      if (looksLikeProductUrl(loc)) productUrls.push(loc);
    }
  }

  if (productUrls.length < 5 && pagesFetched < maxPages) {
    const shopify = await fetchPublicHtmlPage(`${origin}/products.json`, {
      timeoutMs: 6000,
    });
    pagesFetched += 1;
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

  // Homepage + common collection paths for product links
  if (productUrls.length < maxProductUrls && pagesFetched < maxPages) {
    const pathHints = [
      "/",
      "/collections/all",
      "/collections/products",
      "/shop",
      "/products",
      "/product/list.html",
      "/goods/goods_list.php",
      "/shop/shopbrand.html",
      "/shop/shopbrand.html?xcode=ALL&type=X&mcode=001",
    ];
    for (const p of pathHints) {
      if (productUrls.length >= maxProductUrls || pagesFetched >= maxPages) break;
      const page = await fetchPublicHtmlPage(`${origin}${p}`, {
        timeoutMs: 8000,
      });
      pagesFetched += 1;
      if (!page.ok) continue;
      if (/captcha|cf-challenge|attention required/i.test(page.html)) {
        blocked = true;
        reasons.push("challenge on listing page — 우회 안 함");
        break;
      }
      const hrefRe = /href=["']([^"']+)["']/gi;
      let hm: RegExpExecArray | null;
      while ((hm = hrefRe.exec(page.html)) && productUrls.length < maxProductUrls) {
        const raw = hm[1];
        if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
        let abs = raw;
        try {
          abs = new URL(raw, origin).href;
        } catch {
          continue;
        }
        if (!abs.startsWith(origin)) continue;
        if (looksLikeProductUrl(abs)) productUrls.push(abs);
      }
    }
  }

  const uniqueProducts = [...new Set(productUrls)].slice(0, maxProductUrls);
  const verified = resolution.classification === "verified_official" && !blocked;
  const needsReview =
    blocked ||
    !verified ||
    uniqueProducts.length === 0 ||
    resolution.classification === "likely_official";

  if (!uniqueProducts.length) reasons.push("제품 URL 수집 부족");

  return {
    brandKey: brand.brandKey,
    candidateUrl: origin,
    verified,
    confidence: resolution.confidence,
    connector,
    blocked,
    needsReview,
    reasons,
    sitemapUrls: [...new Set(sitemapUrls)].slice(0, 30),
    productUrls: uniqueProducts,
    resolution: {
      classification: resolution.classification,
      confidence: resolution.confidence,
      allowCrawl: resolution.allowCrawl,
      selectedUrl: resolution.selectedUrl,
      reasons: resolution.reasons,
    },
  };
}

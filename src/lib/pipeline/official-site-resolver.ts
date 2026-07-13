import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractDomain, normalizeTextKey } from "@/lib/admin/import/normalize";
import { assertSafePublicHttpsUrl } from "@/lib/admin/import/ssrf";
import { fetchPublicHtmlPage } from "@/lib/admin/import/fetch-page";
import {
  brandNameMatchesHost,
  canAutoCrawl,
  classifyHost,
  type DomainClass,
} from "@/lib/pipeline/domain-class";
import type { BrandSeed } from "@/lib/pipeline/types";

export type OfficialSiteCandidate = {
  url: string;
  domain: string | null;
  source:
    | "brands_table"
    | "seed_config"
    | "product_link"
    | "catalog_json"
    | "domain_pattern";
  score: number;
  reasons: string[];
};

export type OfficialSiteResolution = {
  brandKey: string;
  canonicalName: string;
  selectedUrl: string | null;
  classification: DomainClass;
  confidence: number;
  reasons: string[];
  candidates: OfficialSiteCandidate[];
  allowCrawl: boolean;
  connectorHint: string | null;
};

type SeedFile = {
  seeds?: Array<{ brandKey: string; urls: string[] }>;
};

let seedCache: SeedFile | null = null;

async function loadSeedFile(): Promise<SeedFile> {
  if (seedCache) return seedCache;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "pipeline", "brand-official-seeds.json"),
      "utf8"
    );
    seedCache = JSON.parse(raw) as SeedFile;
  } catch {
    seedCache = { seeds: [] };
  }
  return seedCache;
}

function pushCandidate(
  list: OfficialSiteCandidate[],
  url: string,
  source: OfficialSiteCandidate["source"],
  score: number,
  reason: string
) {
  const domain = extractDomain(url);
  if (!domain) return;
  const hostClass = classifyHost(domain);
  if (hostClass === "marketplace" || hostClass === "social") {
    list.push({
      url,
      domain,
      source,
      score: Math.min(score, 0.2),
      reasons: [reason, `host classified ${hostClass}`],
    });
    return;
  }
  const existing = list.find((c) => c.domain === domain);
  if (existing) {
    existing.score = Math.max(existing.score, score);
    existing.reasons.push(reason);
    return;
  }
  list.push({ url, domain, source, score, reasons: [reason] });
}

/**
 * Collect official-site URL candidates from internal catalog data + seeds.
 * Does not invent unverified crawl targets without scoring.
 */
export async function collectOfficialSiteCandidates(
  brand: BrandSeed
): Promise<OfficialSiteCandidate[]> {
  const client = createSupabaseAdminClient();
  const out: OfficialSiteCandidate[] = [];

  if (brand.officialWebsite) {
    pushCandidate(
      out,
      brand.officialWebsite,
      "brands_table",
      0.85,
      "brands.official_website"
    );
  }

  const seeds = await loadSeedFile();
  for (const seed of seeds.seeds ?? []) {
    if (normalizeTextKey(seed.brandKey) !== brand.brandKey) continue;
    for (const url of seed.urls ?? []) {
      pushCandidate(out, url, "seed_config", 0.8, "brand-official-seeds.json");
    }
  }

  // Product retailer links — collect for classification, low score
  const { data: products } = await client
    .from("products")
    .select(
      "brand, link_oliveyoung, link_coupang, link_amazon_us, link_amazon_jp, link_sephora, link_yesstyle, link_qoo10"
    )
    .ilike("brand", brand.canonicalName)
    .limit(50);

  const domainFreq = new Map<string, number>();
  for (const row of products ?? []) {
    const links = [
      (row as { link_oliveyoung?: string }).link_oliveyoung,
      (row as { link_coupang?: string }).link_coupang,
      (row as { link_amazon_us?: string }).link_amazon_us,
      (row as { link_amazon_jp?: string }).link_amazon_jp,
      (row as { link_sephora?: string }).link_sephora,
      (row as { link_yesstyle?: string }).link_yesstyle,
      (row as { link_qoo10?: string }).link_qoo10,
    ];
    for (const link of links) {
      if (!link) continue;
      const d = extractDomain(link);
      if (!d) continue;
      domainFreq.set(d, (domainFreq.get(d) ?? 0) + 1);
      pushCandidate(out, link, "product_link", 0.15, "products retailer link");
    }
  }

  // brands.source_url / official_website (exact-ish match in app)
  const { data: brandRows } = await client
    .from("brands")
    .select("canonical_name, name_en, official_website, source_url")
    .limit(500);

  for (const row of brandRows ?? []) {
    const r = row as {
      canonical_name?: string | null;
      name_en?: string | null;
      official_website?: string | null;
      source_url?: string | null;
    };
    const names = [r.canonical_name, r.name_en].filter(Boolean) as string[];
    if (!names.some((n) => normalizeTextKey(n) === brand.brandKey)) continue;
    if (r.official_website) {
      pushCandidate(out, r.official_website, "brands_table", 0.88, "brands row");
    }
    if (r.source_url) {
      pushCandidate(out, r.source_url, "brands_table", 0.55, "brands.source_url");
    }
  }

  // Domain pattern guesses only as low-score candidates pending page verify
  const slug = brand.canonicalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  if (slug.length >= 4) {
    for (const host of [`https://www.${slug}.com`, `https://${slug}.com`]) {
      pushCandidate(out, host, "domain_pattern", 0.35, "brand-name domain pattern");
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

async function verifyCandidatePage(
  brand: BrandSeed,
  candidate: OfficialSiteCandidate
): Promise<{ ok: boolean; confidence: number; reasons: string[]; blocked: boolean }> {
  const safe = await assertSafePublicHttpsUrl(candidate.url);
  if (!safe.ok) {
    return { ok: false, confidence: 0, reasons: [safe.message], blocked: false };
  }

  const hostClass = classifyHost(safe.url.hostname);
  if (hostClass === "marketplace" || hostClass === "social") {
    return {
      ok: false,
      confidence: 0.1,
      reasons: [`${hostClass} — 공식 crawl 제외`],
      blocked: false,
    };
  }

  const page = await fetchPublicHtmlPage(safe.normalizedHref, { timeoutMs: 8000 });
  if (!page.ok) {
    return {
      ok: false,
      confidence: 0,
      reasons: [page.message],
      blocked: page.code === "FETCH_FAILED",
    };
  }
  if (/captcha|cf-challenge|attention required|login required/i.test(page.html)) {
    return {
      ok: false,
      confidence: 0,
      reasons: ["challenge/captcha/login — 우회 안 함"],
      blocked: true,
    };
  }

  let confidence = candidate.score;
  const reasons = [...candidate.reasons];
  const html = page.html.slice(0, 200_000);
  const brandToken = brand.canonicalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (brandNameMatchesHost(brand.canonicalName, safe.url.hostname)) {
    confidence += 0.15;
    reasons.push("도메인-브랜드명 일치");
  }
  if (new RegExp(brandToken, "i").test(html)) {
    confidence += 0.12;
    reasons.push("페이지 본문에 브랜드명");
  }
  if (/application\/ld\+json/i.test(html) && /"@type"\s*:\s*"Organization"|"Brand"/i.test(html)) {
    confidence += 0.08;
    reasons.push("JSON-LD Organization/Brand");
  }
  if (/sitemap|\/products\//i.test(html)) {
    confidence += 0.05;
    reasons.push("product/sitemap 힌트");
  }

  confidence = Math.min(0.95, confidence);
  const ok = confidence >= 0.55 && hostClass == null;
  return { ok, confidence, reasons, blocked: false };
}

/**
 * Resolve best official site for a brand with classification + crawl permission.
 */
export async function resolveOfficialSite(
  brand: BrandSeed
): Promise<OfficialSiteResolution> {
  const candidates = await collectOfficialSiteCandidates(brand);
  if (!candidates.length) {
    return {
      brandKey: brand.brandKey,
      canonicalName: brand.canonicalName,
      selectedUrl: null,
      classification: "needs_review",
      confidence: 0.2,
      reasons: ["공식 사이트 후보 없음"],
      candidates: [],
      allowCrawl: false,
      connectorHint: null,
    };
  }

  // Prefer non-marketplace candidates
  const ordered = candidates.filter((c) => {
    const h = c.domain ? classifyHost(c.domain) : null;
    return h !== "marketplace" && h !== "social";
  });

  const tryList = (ordered.length ? ordered : candidates).slice(0, 6);
  let best: OfficialSiteResolution | null = null;

  for (const cand of tryList) {
    const hostClass = cand.domain ? classifyHost(cand.domain) : null;
    if (hostClass === "marketplace") {
      best ??= {
        brandKey: brand.brandKey,
        canonicalName: brand.canonicalName,
        selectedUrl: cand.url,
        classification: "marketplace",
        confidence: 0.2,
        reasons: cand.reasons,
        candidates,
        allowCrawl: false,
        connectorHint: null,
      };
      continue;
    }

    const verified = await verifyCandidatePage(brand, cand);
    if (verified.blocked) {
      return {
        brandKey: brand.brandKey,
        canonicalName: brand.canonicalName,
        selectedUrl: cand.url,
        classification: "blocked",
        confidence: 0,
        reasons: verified.reasons,
        candidates,
        allowCrawl: false,
        connectorHint: null,
      };
    }

    let classification: DomainClass = "needs_review";
    if (verified.ok && verified.confidence >= 0.8) {
      classification = "verified_official";
    } else if (verified.ok && verified.confidence >= 0.65) {
      classification = "likely_official";
    } else if (!verified.ok) {
      classification = "unrelated";
    }

    const resolution: OfficialSiteResolution = {
      brandKey: brand.brandKey,
      canonicalName: brand.canonicalName,
      selectedUrl: cand.url,
      classification,
      confidence: verified.confidence,
      reasons: verified.reasons,
      candidates,
      allowCrawl: canAutoCrawl(classification, verified.confidence),
      connectorHint: "generic_sitemap",
    };

    if (resolution.allowCrawl) return resolution;
    if (
      !best ||
      resolution.confidence > best.confidence ||
      (classification === "likely_official" && best.classification === "needs_review")
    ) {
      best = resolution;
    }
  }

  return (
    best ?? {
      brandKey: brand.brandKey,
      canonicalName: brand.canonicalName,
      selectedUrl: null,
      classification: "needs_review",
      confidence: 0.25,
      reasons: ["후보 검증 실패"],
      candidates,
      allowCrawl: false,
      connectorHint: null,
    }
  );
}

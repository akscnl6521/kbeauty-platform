/**
 * Discovery enrichment: classify placeholders vs matchable heroes,
 * robots-aware official fetch, never invent INCI/prices.
 */

import { createHash } from "node:crypto";
import { isDomainOnBrandAllowlist } from "@/lib/catalog/automation/brandAllowlist";
import {
  parseJsonLdIngredients,
  parseJsonLdOffers,
  parseJsonLdProductDocument,
} from "@/lib/catalog/automation/jsonLdParser";
import { contentHash } from "@/lib/catalog/automation/validators";
import type { FetchedProductDocument } from "@/lib/catalog/automation/types";
import { beautyDomainForCategory } from "@/lib/catalog/taxonomy/domains";

export type EnrichmentMatchClass =
  | "official_matched"
  | "match_failed"
  | "placeholder"
  | "duplicate"
  | "discontinued_suspect"
  | "renewal_suspect"
  | "needs_review"
  | "rejected_candidate";

export type EnrichmentRecord = {
  externalProductId: string;
  brand: string;
  brandIdHint: string;
  nameRaw: string;
  category: string | null;
  officialUrl: string | null;
  curatedProvenance: string | null;
  matchClass: EnrichmentMatchClass;
  reasons: string[];
  officialName: string | null;
  description: string | null;
  imageRemoteUrl: string | null;
  imageStatus: "remote_reference" | "broken" | "missing" | "unknown";
  imageContentHash: string | null;
  price: number | null;
  currency: string | null;
  availability: string | null;
  fullIngredients: string[];
  keyIngredients: string[];
  evidenceSlugs: string[];
  attributes: Record<string, unknown>;
  fetchedAt: string | null;
  sourceHost: string | null;
  robotsAllowed: boolean | null;
};

export type BrandCheckpoint = {
  brandId: string;
  status: "pending" | "running" | "completed" | "skipped" | "blocked";
  processed: number;
  matched: number;
  failed: number;
  placeholders: number;
  lastError: string | null;
  updatedAt: string;
};

const EVIDENCE_MAP: Record<string, string> = {
  panthenol: "panthenol",
  "centella asiatica": "centella-asiatica",
  niacinamide: "niacinamide",
  "sodium hyaluronate": "hyaluronic-acid",
  "salicylic acid": "salicylic-acid",
  retinol: "retinol",
  "ascorbic acid": "ascorbic-acid",
  "zinc oxide": "zinc-oxide",
  "snail secretion filtrate": "snail-mucin",
};

const robotsCache = new Map<string, boolean>();

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function classifyProvenance(input: {
  curatedProvenance?: string | null;
  validationWarnings?: unknown;
  name?: string | null;
  officialUrl?: string | null;
}): EnrichmentMatchClass {
  const warnings = Array.isArray(input.validationWarnings)
    ? input.validationWarnings.map(String)
    : [];
  const name = String(input.name ?? "");
  if (
    input.curatedProvenance === "category_discovery" ||
    warnings.includes("discovery_placeholder") ||
    /발견 후보|discovery candidate/i.test(name)
  ) {
    return "placeholder";
  }
  if (warnings.includes("duplicate_canonical_or_slug")) return "duplicate";
  if (!input.officialUrl || !/^https:\/\//i.test(input.officialUrl)) {
    return "match_failed";
  }
  return "needs_review";
}

export async function robotsAllowsPath(
  baseOrigin: string,
  path: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const key = new URL(baseOrigin).origin;
  if (robotsCache.has(key)) return robotsCache.get(key)!;
  try {
    const res = await fetchImpl(new URL("/robots.txt", key).toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "KBeautyMatchBot/0.1 (+staging-enrichment)" },
    });
    if (!res.ok) {
      robotsCache.set(key, false);
      return false;
    }
    const text = await res.text();
    const lower = text.toLowerCase();
    const uaStar = lower.split("user-agent:");
    let disallowAll = false;
    for (const block of uaStar) {
      if (!block.trim().startsWith("*")) continue;
      if (/disallow:\s*\/\s*($|\n)/.test(block)) disallowAll = true;
    }
    if (
      path &&
      new RegExp(
        `disallow:\\s*${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      ).test(text)
    ) {
      disallowAll = true;
    }
    robotsCache.set(key, !disallowAll);
    return !disallowAll;
  } catch {
    robotsCache.set(key, false);
    return false;
  }
}

function mapEvidence(ingredients: string[]): string[] {
  const out = new Set<string>();
  for (const ing of ingredients) {
    const mapped = EVIDENCE_MAP[ing.trim().toLowerCase()];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

export function unknownAttrs(
  base: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    curling: "unknown",
    volume: "unknown",
    longLash: "unknown",
    waterproof: "unknown",
    smudge: "unknown",
    brushType: "unknown",
    cleansingDifficulty: "unknown",
    shadeName: "unknown",
    tone: "unknown",
    brightness: "unknown",
    saturation: "unknown",
    finish: "unknown",
    stain: "unknown",
    hydrating: "unknown",
    shadeCode: "unknown",
    undertone: "unknown",
    coverage: "unknown",
    lasting: "unknown",
    scalpType: "unknown",
    hairType: "unknown",
    damageCare: "unknown",
    colorCare: "unknown",
    heatProtect: "unknown",
    volumeHair: "unknown",
    ...base,
  };
}

export async function enrichOfficialUrl(input: {
  externalProductId: string;
  brand: string;
  brandIdHint: string;
  nameRaw: string;
  category: string | null;
  officialUrl: string;
  curatedProvenance: string | null;
  existingAttributes?: Record<string, unknown>;
  dryFetch?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<EnrichmentRecord> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base: EnrichmentRecord = {
    externalProductId: input.externalProductId,
    brand: input.brand,
    brandIdHint: input.brandIdHint,
    nameRaw: input.nameRaw,
    category: input.category,
    officialUrl: input.officialUrl,
    curatedProvenance: input.curatedProvenance,
    matchClass: "needs_review",
    reasons: [],
    officialName: null,
    description: null,
    imageRemoteUrl: null,
    imageStatus: "missing",
    imageContentHash: null,
    price: null,
    currency: null,
    availability: null,
    fullIngredients: [],
    keyIngredients: [],
    evidenceSlugs: [],
    attributes: unknownAttrs(input.existingAttributes),
    fetchedAt: null,
    sourceHost: hostOf(input.officialUrl),
    robotsAllowed: null,
  };

  if (input.curatedProvenance === "category_discovery") {
    return {
      ...base,
      matchClass: "rejected_candidate",
      reasons: ["placeholder_not_recommendable"],
    };
  }

  const host = hostOf(input.officialUrl);
  if (!host || !isDomainOnBrandAllowlist(host)) {
    return {
      ...base,
      matchClass: "match_failed",
      reasons: ["official_domain_not_allowlisted"],
    };
  }

  if (input.dryFetch) {
    return {
      ...base,
      matchClass: "needs_review",
      reasons: ["dry_fetch_skip_network"],
    };
  }

  let origin: string;
  let path: string;
  try {
    const u = new URL(input.officialUrl);
    origin = u.origin;
    path = u.pathname;
  } catch {
    return {
      ...base,
      matchClass: "match_failed",
      reasons: ["invalid_official_url"],
    };
  }

  const allowed = await robotsAllowsPath(origin, path, fetchImpl);
  base.robotsAllowed = allowed;
  if (!allowed) {
    return {
      ...base,
      matchClass: "needs_review",
      reasons: ["robots_disallow_or_unavailable"],
    };
  }

  try {
    const res = await fetchImpl(input.officialUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent":
          "KBeautyMatchBot/0.1 (+staging-enrichment; respect-robots)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    base.fetchedAt = new Date().toISOString();
    if (res.status === 404) {
      return {
        ...base,
        matchClass: "discontinued_suspect",
        reasons: ["http_404"],
      };
    }
    if (!res.ok) {
      return {
        ...base,
        matchClass: "match_failed",
        reasons: [`http_${res.status}`],
      };
    }
    const html = await res.text();
    const doc: FetchedProductDocument = {
      url: input.officialUrl,
      httpStatus: res.status,
      fetchedAt: base.fetchedAt,
      html,
      contentType: res.headers.get("content-type") ?? "text/html",
      contentHash: contentHash(html),
      sourceMethod: "http_get_robots_allowed",
    };
    const parsed = parseJsonLdProductDocument(doc);
    if (!parsed) {
      return {
        ...base,
        matchClass: "needs_review",
        reasons: ["no_json_ld_product"],
      };
    }

    const name =
      parsed.productNameEn || parsed.productNameKo || parsed.productNameRaw;
    const curated = input.nameRaw.toLowerCase();
    const fetched = name.toLowerCase();
    if (
      curated &&
      fetched &&
      !curated.includes(fetched.slice(0, Math.min(12, fetched.length))) &&
      !fetched.includes(curated.slice(0, Math.min(12, curated.length)))
    ) {
      base.reasons.push("renewal_or_name_mismatch_suspect");
    }

    const images = parsed.imageUrls ?? [];
    const primary = parsed.primaryImageUrl ?? images[0] ?? null;
    let imageStatus: EnrichmentRecord["imageStatus"] = "missing";
    let imageHash: string | null = null;
    if (primary) {
      imageStatus = "remote_reference";
      imageHash = createHash("sha256")
        .update(primary)
        .digest("hex")
        .slice(0, 16);
      try {
        const head = await fetchImpl(primary, {
          method: "HEAD",
          signal: AbortSignal.timeout(6000),
          redirect: "follow",
        });
        if (!head.ok) imageStatus = "broken";
      } catch {
        imageStatus = "unknown";
      }
    }

    const ing = parseJsonLdIngredients(doc, parsed);
    const fullIngredients =
      ing?.tokens
        .map((t) => t.inciName || t.ingredientRaw)
        .filter((x): x is string => Boolean(x)) ?? [];

    const offers = parseJsonLdOffers(doc, parsed);
    const offer = offers[0];
    const attrs = unknownAttrs({
      ...(input.existingAttributes ?? {}),
      finish: parsed.finish ?? "unknown",
      coverage: parsed.coverage ?? "unknown",
      shadeFamily: parsed.shadeFamily ?? "unknown",
      beautyDomain: beautyDomainForCategory(input.category),
    });

    const matchClass: EnrichmentMatchClass =
      base.reasons.includes("renewal_or_name_mismatch_suspect")
        ? "renewal_suspect"
        : fullIngredients.length > 0 || Boolean(primary)
          ? "official_matched"
          : "needs_review";

    return {
      ...base,
      matchClass,
      reasons: [
        ...base.reasons,
        "json_ld_parsed",
        ...(fullIngredients.length
          ? ["inci_from_official_document"]
          : ["inci_missing"]),
      ],
      officialName: name,
      description: parsed.descriptionRaw ?? null,
      imageRemoteUrl: primary,
      imageStatus,
      imageContentHash: imageHash,
      price: offer?.price ?? null,
      currency: offer?.currency ?? null,
      availability: offer?.availabilityRaw ?? null,
      fullIngredients,
      keyIngredients: fullIngredients.slice(0, 8),
      evidenceSlugs: mapEvidence(fullIngredients),
      attributes: attrs,
    };
  } catch (err) {
    return {
      ...base,
      matchClass: "match_failed",
      reasons: [
        `fetch_error:${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`,
      ],
    };
  }
}

export function stagingStatusFor(matchClass: EnrichmentMatchClass): string {
  switch (matchClass) {
    case "official_matched":
      return "source_verified";
    case "placeholder":
    case "rejected_candidate":
      return "rejected";
    case "duplicate":
      return "duplicate_candidate";
    default:
      return "needs_review";
  }
}

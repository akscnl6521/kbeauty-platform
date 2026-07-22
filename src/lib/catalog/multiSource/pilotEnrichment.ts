/**
 * Offline scenario-pilot enrichment (dry-run artifacts only).
 * No network, no DB, no .env.
 */

import fs from "node:fs";
import path from "node:path";
import { mergeIngredientStatus } from "./ingredientMerge";
import {
  buildProductId,
  maybeSameProduct,
  normalizeBrand,
  normalizeProductName,
} from "./productIdentity";
import { promoteReadiness } from "./readinessPromote";
import type {
  ImageEvidence,
  IngredientEvidence,
  MergedMultiSourceProduct,
  MultiSourceChannel,
  OfferEvidence,
  ProductIdentity,
  ProductReadinessState,
  SourceEvidence,
  SourceTrustTier,
} from "./types";

export type PilotCandidate = {
  productIdentity: string;
  brand: string;
  normalizedProductName: string;
  category: string;
  roleTags?: string[];
  cautionIngredients?: string[];
  affiliateOrAdInScore?: boolean;
  readiness?: ProductReadinessState;
  rejectionReason?: string | null;
  scenarioFit?: { fitNotes?: string; fitScore?: number };
  ingredientEvidence?: {
    present?: boolean;
    inciAvailable?: boolean;
    sourceUrls?: string[];
    notes?: string;
  };
  imageEvidence?: { present?: boolean; sourceUrls?: string[]; notes?: string };
  offerEvidence?: {
    present?: boolean;
    offerUrl?: string | null;
    notes?: string;
  };
  sourceUrls?: string[];
};

export type PilotPoolFile = {
  scenarioId: string;
  displayNameKo?: string;
  coreScenarioRef?: string;
  brandCapDefault?: number;
  affiliateOrAdInScore?: boolean;
  notes?: string | null;
  candidates: PilotCandidate[];
};

export type EvidencePackProduct = {
  productIdentity: string;
  volumeLabel?: string | null;
  gtin?: string | null;
  canonicalUrl?: string | null;
  ingredients?: Array<{
    raw: string;
    trust: SourceTrustTier;
    channel: MultiSourceChannel;
    sourceUrl: string;
    checkedAt: string;
  }>;
  images?: Array<{
    imageUrl: string;
    trust: SourceTrustTier;
    channel: MultiSourceChannel;
    sourcePageUrl: string;
    checkedAt: string;
    isOfficialSource?: boolean;
  }>;
  offers?: Array<{
    retailerName: string;
    trust: SourceTrustTier;
    channel: MultiSourceChannel;
    purchaseUrl: string;
    price: number | null;
    currency: string | null;
    inStock: boolean | null;
    isOfficialStore: boolean;
    checkedAt: string;
    sourceVerified: boolean;
  }>;
  sourceEvidences?: SourceEvidence[];
  criticalConflict?: boolean;
  unavailable?: boolean;
  cautionIngredients?: string[];
};

export type EvidencePack = {
  packDate: string;
  notes?: string[];
  products: EvidencePackProduct[];
  /** Curated many-to-many membership beyond original pilot isolation. */
  crossMembership?: Array<{
    productIdentity: string;
    scenarioIds: string[];
    fitNotes: string;
    categoryException?: string;
  }>;
  /** Products dropped from a scenario when inserting a cross-listed product (keep 10). */
  poolSlotPlan?: Record<string, string[]>;
};

export type EnrichmentOptions = {
  pilotDir: string;
  evidencePackPath: string;
  outDir: string;
  brandCapDefault?: number;
};

export type EnrichmentResult = {
  products: MergedMultiSourceProduct[];
  scenarioPools: Record<
    string,
    {
      scenarioId: string;
      brandCapDefault: number;
      affiliateOrAdInScore: false;
      slots: Array<{
        productId: string;
        readiness: ProductReadinessState;
        rejectionReason: string | null;
        roleTags: string[];
      }>;
    }
  >;
  sourceEvidence: SourceEvidence[];
  ingredientConflicts: Array<{
    productId: string;
    mismatches: string[];
    status: string;
  }>;
  duplicateMergeReport: {
    merges: Array<{
      kept: string;
      dropped: string;
      reason: string;
      score: number;
    }>;
    notes: string[];
  };
  readinessReport: {
    totals: Record<ProductReadinessState, number>;
    perScenario: Record<string, Record<ProductReadinessState, number>>;
    recommendationReadyTotal: number;
    shortfallNotes: string[];
  };
  reuseAnalysis: {
    totalSlots: number;
    uniqueProducts: number;
    reuseCount: number;
    reuseRate: number;
    targetMin: number;
    targetMax: number;
    metTarget: boolean;
    failureReason: string | null;
  };
  manifest: Record<string, unknown>;
};

const PILOT_FILES = [
  "A-kr-redness-sensitive-cream.json",
  "B-pilot-dryness-barrier-serum.json",
  "C-kr-acne-pores-toner.json",
  "D-kr-uv-sunscreen-sensitive.json",
  "E-kr-aging-eye-cream.json",
] as const;

const READINESS_KEYS: ProductReadinessState[] = [
  "trend_candidate",
  "catalog_ready",
  "ingredient_candidate",
  "recommendation_ready",
  "review_required",
  "unavailable",
];

function emptyReadinessCounts(): Record<ProductReadinessState, number> {
  const o = {} as Record<ProductReadinessState, number>;
  for (const k of READINESS_KEYS) o[k] = 0;
  return o;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, { encoding: "utf8" })) as T;
}

function writeUtf8Json(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", {
    encoding: "utf8",
  });
}

function toIngredientEvidences(
  pack: EvidencePackProduct | undefined
): IngredientEvidence[] {
  if (!pack?.ingredients?.length) return [];
  return pack.ingredients.map((i) => ({
    raw: i.raw,
    status: "source_verified_candidate" as const,
    trust: i.trust,
    channel: i.channel,
    sourceUrl: i.sourceUrl,
    checkedAt: i.checkedAt,
  }));
}

function toImages(pack: EvidencePackProduct | undefined): ImageEvidence[] {
  if (!pack?.images?.length) return [];
  return pack.images.map((img) => ({
    imageUrl: img.imageUrl,
    trust: img.trust,
    channel: img.channel,
    sourcePageUrl: img.sourcePageUrl,
    checkedAt: img.checkedAt,
    isOfficialSource: img.isOfficialSource !== false,
  }));
}

function toOffers(pack: EvidencePackProduct | undefined): OfferEvidence[] {
  if (!pack?.offers?.length) return [];
  return pack.offers.map((o) => ({
    retailerName: o.retailerName,
    trust: o.trust,
    channel: o.channel,
    purchaseUrl: o.purchaseUrl,
    price: o.price,
    currency: o.currency,
    inStock: o.inStock,
    isOfficialStore: o.isOfficialStore,
    checkedAt: o.checkedAt,
    sourceVerified: o.sourceVerified,
  }));
}

type WorkingProduct = {
  productId: string;
  brand: string;
  productName: string;
  category: string;
  scenarioIds: Set<string>;
  roleTags: Set<string>;
  cautionIngredients: string[];
  affiliateOrAdInScore: false;
  volumeLabel: string | null;
  gtin: string | null;
  canonicalUrl: string | null;
  pack?: EvidencePackProduct;
  fitByScenario: Record<string, string>;
};

export function runPilotEnrichment(
  opts: EnrichmentOptions
): EnrichmentResult {
  const brandCap = opts.brandCapDefault ?? 2;
  const pack = readJson<EvidencePack>(opts.evidencePackPath);
  const packById = new Map(
    pack.products.map((p) => [p.productIdentity, p] as const)
  );

  const working = new Map<string, WorkingProduct>();
  const duplicateMerges: EnrichmentResult["duplicateMergeReport"]["merges"] =
    [];

  for (const file of PILOT_FILES) {
    const pool = readJson<PilotPoolFile>(path.join(opts.pilotDir, file));
    for (const c of pool.candidates) {
      const packRow = packById.get(c.productIdentity);
      const incoming: WorkingProduct = {
        productId: c.productIdentity,
        brand: c.brand,
        productName: c.normalizedProductName,
        category: c.category,
        scenarioIds: new Set([pool.scenarioId]),
        roleTags: new Set(c.roleTags || []),
        cautionIngredients: [
          ...(c.cautionIngredients || []),
          ...(packRow?.cautionIngredients || []),
        ],
        affiliateOrAdInScore: false,
        volumeLabel: packRow?.volumeLabel ?? null,
        gtin: packRow?.gtin ?? null,
        canonicalUrl: packRow?.canonicalUrl ?? c.sourceUrls?.[0] ?? null,
        pack: packRow,
        fitByScenario: {
          [pool.scenarioId]:
            c.scenarioFit?.fitNotes || "Pilot scenario fit retained.",
        },
      };

      let mergedInto: string | null = null;
      for (const [existingId, existing] of working) {
        const same = maybeSameProduct(
          {
            brand: existing.brand,
            productName: existing.productName,
            volumeLabel: existing.volumeLabel,
            gtin: existing.gtin,
            canonicalUrl: existing.canonicalUrl,
          },
          {
            brand: incoming.brand,
            productName: incoming.productName,
            volumeLabel: incoming.volumeLabel,
            gtin: incoming.gtin,
            canonicalUrl: incoming.canonicalUrl,
          }
        );
        if (same.same && existingId !== incoming.productId) {
          mergedInto = existingId;
          duplicateMerges.push({
            kept: existingId,
            dropped: incoming.productId,
            reason: same.reason,
            score: same.score,
          });
          for (const s of incoming.scenarioIds) existing.scenarioIds.add(s);
          for (const t of incoming.roleTags) existing.roleTags.add(t);
          Object.assign(existing.fitByScenario, incoming.fitByScenario);
          if (!existing.pack && incoming.pack) existing.pack = incoming.pack;
          break;
        }
      }
      if (!mergedInto) {
        if (working.has(incoming.productId)) {
          const ex = working.get(incoming.productId)!;
          for (const s of incoming.scenarioIds) ex.scenarioIds.add(s);
          for (const t of incoming.roleTags) ex.roleTags.add(t);
          Object.assign(ex.fitByScenario, incoming.fitByScenario);
          if (!ex.pack && incoming.pack) ex.pack = incoming.pack;
        } else {
          working.set(incoming.productId, incoming);
        }
      }
    }
  }

  // Apply curated cross-membership (many-to-many)
  for (const cm of pack.crossMembership || []) {
    const row = working.get(cm.productIdentity);
    if (!row) continue;
    for (const sid of cm.scenarioIds) {
      row.scenarioIds.add(sid);
      row.fitByScenario[sid] = cm.fitNotes;
    }
  }

  // Build scenario slot lists from poolSlotPlan or derived membership
  const scenarioIds = [
    "kr-redness-sensitive-cream",
    "pilot-dryness-barrier-serum",
    "kr-acne-pores-toner",
    "kr-uv-sunscreen-sensitive",
    "kr-aging-eye-cream",
  ];

  const slotsByScenario: Record<string, string[]> = {};
  if (pack.poolSlotPlan) {
    for (const sid of scenarioIds) {
      slotsByScenario[sid] = [...(pack.poolSlotPlan[sid] || [])];
    }
  } else {
    for (const sid of scenarioIds) {
      slotsByScenario[sid] = [];
      for (const [pid, row] of working) {
        if (row.scenarioIds.has(sid)) slotsByScenario[sid].push(pid);
      }
      slotsByScenario[sid] = slotsByScenario[sid].slice(0, 10);
    }
  }

  // Sync scenarioIds from final slot plan
  for (const row of working.values()) row.scenarioIds.clear();
  for (const [sid, ids] of Object.entries(slotsByScenario)) {
    for (const pid of ids) {
      const row = working.get(pid);
      if (row) row.scenarioIds.add(sid);
    }
  }

  // Drop products with zero membership after plan
  for (const pid of [...working.keys()]) {
    if (working.get(pid)!.scenarioIds.size === 0) working.delete(pid);
  }

  const products: MergedMultiSourceProduct[] = [];
  const allSourceEvidence: SourceEvidence[] = [];
  const ingredientConflicts: EnrichmentResult["ingredientConflicts"] = [];
  const productReadiness = new Map<
    string,
    { readiness: ProductReadinessState; rejectionReason: string | null }
  >();

  for (const [pid, row] of working) {
    const packRow = row.pack || packById.get(pid);
    const ingredientEvidences = toIngredientEvidences(packRow);
    const merged = mergeIngredientStatus(ingredientEvidences);
    const images = toImages(packRow);
    const offers = toOffers(packRow);
    const sourceEvidences = [...(packRow?.sourceEvidences || [])];
    allSourceEvidence.push(...sourceEvidences);

    if (merged.mismatches.length) {
      ingredientConflicts.push({
        productId: pid,
        mismatches: merged.mismatches,
        status: merged.status,
      });
    }

    const promoted = promoteReadiness({
      ingredientStatus: merged.status,
      ingredientMismatches: merged.mismatches,
      images,
      offers,
      sourceEvidences,
      hasIdentity: Boolean(pid && row.brand && row.productName),
      criticalConflict: Boolean(packRow?.criticalConflict),
      unavailable: Boolean(packRow?.unavailable),
    });
    productReadiness.set(pid, promoted);

    const identity: ProductIdentity = {
      productId: pid,
      brand: row.brand,
      productName: row.productName,
      normalizedBrand: normalizeBrand(row.brand),
      normalizedName: normalizeProductName(row.productName),
      volumeLabel: row.volumeLabel,
      gtin: row.gtin,
      canonicalUrl: row.canonicalUrl,
      imageHash: null,
      category: row.category,
      scenarioIds: [...row.scenarioIds].sort(),
    };

    products.push({
      brandId: normalizeBrand(row.brand),
      brand: row.brand,
      productName: row.productName,
      externalProductId: pid,
      sizeLabel: row.volumeLabel,
      officialUrl: row.canonicalUrl,
      primaryUrl: row.canonicalUrl || offers[0]?.purchaseUrl || "",
      ingredientsRaw: merged.raw,
      ingredientStatus: merged.status,
      ingredientEvidences,
      images,
      offers,
      sourceEvidences,
      mismatches: merged.mismatches,
      duplicate: duplicateMerges.some((m) => m.kept === pid),
      qualityNotes: Object.values(row.fitByScenario),
      productIdentity: identity,
      readiness: promoted.readiness,
      rejectionReason: promoted.rejectionReason,
      roleTags: [...row.roleTags],
      affiliateOrAdInScore: false,
      cautionIngredients: row.cautionIngredients,
    });
  }

  // Brand-cap check / note (do not auto-violate; plan should already satisfy)
  for (const [sid, ids] of Object.entries(slotsByScenario)) {
    const brandCounts: Record<string, number> = {};
    for (const pid of ids) {
      const p = working.get(pid);
      if (!p) continue;
      const b = normalizeBrand(p.brand);
      brandCounts[b] = (brandCounts[b] || 0) + 1;
      if (brandCounts[b] > brandCap) {
        throw new Error(
          `Brand cap ${brandCap} exceeded in ${sid} for brand ${p.brand}`
        );
      }
    }
    if (ids.length !== 10) {
      throw new Error(`${sid}: expected 10 slots, got ${ids.length}`);
    }
  }

  const scenarioPools: EnrichmentResult["scenarioPools"] = {};
  const readinessReport: EnrichmentResult["readinessReport"] = {
    totals: emptyReadinessCounts(),
    perScenario: {},
    recommendationReadyTotal: 0,
    shortfallNotes: [],
  };

  for (const sid of scenarioIds) {
    const counts = emptyReadinessCounts();
    const slots = slotsByScenario[sid].map((productId) => {
      const pr = productReadiness.get(productId)!;
      const row = working.get(productId)!;
      counts[pr.readiness] += 1;
      readinessReport.totals[pr.readiness] += 1;
      return {
        productId,
        readiness: pr.readiness,
        rejectionReason: pr.rejectionReason,
        roleTags: [...row.roleTags],
      };
    });
    scenarioPools[sid] = {
      scenarioId: sid,
      brandCapDefault: brandCap,
      affiliateOrAdInScore: false,
      slots,
    };
    readinessReport.perScenario[sid] = counts;
  }
  readinessReport.recommendationReadyTotal =
    readinessReport.totals.recommendation_ready;

  for (const sid of scenarioIds) {
    const ready = readinessReport.perScenario[sid].recommendation_ready;
    if (ready < 5) {
      readinessReport.shortfallNotes.push(
        `${sid}: recommendation_ready=${ready} (<5); honest shortfall — no fake INCI.`
      );
    }
  }
  if (readinessReport.recommendationReadyTotal < 30) {
    readinessReport.shortfallNotes.push(
      `Total recommendation_ready=${readinessReport.recommendationReadyTotal} (<30); limited official INCI+image+offer packs.`
    );
  }

  const allSlotIds = scenarioIds.flatMap((s) => slotsByScenario[s]);
  const uniqueProducts = new Set(allSlotIds).size;
  const totalSlots = allSlotIds.length;
  const reuseCount = totalSlots - uniqueProducts;
  const reuseRate = totalSlots ? reuseCount / totalSlots : 0;
  const metTarget = reuseRate >= 0.15 && reuseRate <= 0.35;
  const reuseAnalysis: EnrichmentResult["reuseAnalysis"] = {
    totalSlots,
    uniqueProducts,
    reuseCount,
    reuseRate: Number(reuseRate.toFixed(4)),
    targetMin: 0.15,
    targetMax: 0.35,
    metTarget,
    failureReason: metTarget
      ? null
      : `reuseRate ${reuseRate.toFixed(4)} outside 0.15–0.35 (unique=${uniqueProducts}).`,
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    pilotDir: opts.pilotDir,
    evidencePackPath: opts.evidencePackPath,
    outDir: opts.outDir,
    brandCapDefault: brandCap,
    affiliateOrAdInScore: false,
    organicScoreFields: "absent",
    scenarioCount: 5,
    slotCount: totalSlots,
    uniqueProducts,
    reuseRate: reuseAnalysis.reuseRate,
    recommendationReadyTotal: readinessReport.recommendationReadyTotal,
    buildProductIdExample: buildProductId("COSRX", "Advanced Snail 92 All in One Cream"),
    limits: [
      "No WQ-G / DB / Staging write / Production / UI / runtime recommend wiring",
      "No CAPTCHA bypass / mass crawl",
      "Naver/Coupang/OY live fetch blocked_by_policy or skipped in evidence pack",
      "recommendation_ready never forced with fake INCI",
    ],
  };

  return {
    products,
    scenarioPools,
    sourceEvidence: allSourceEvidence,
    ingredientConflicts,
    duplicateMergeReport: {
      merges: duplicateMerges,
      notes: [
        "Pilot pools were curated unique; merges only when identity heuristic matches.",
      ],
    },
    readinessReport,
    reuseAnalysis,
    manifest,
  };
}

export function writeEnrichmentArtifacts(
  result: EnrichmentResult,
  outDir: string
): void {
  fs.mkdirSync(outDir, { recursive: true });
  writeUtf8Json(path.join(outDir, "products.json"), {
    count: result.products.length,
    products: result.products,
  });
  writeUtf8Json(path.join(outDir, "scenario-pools.json"), result.scenarioPools);
  writeUtf8Json(path.join(outDir, "source-evidence.json"), {
    count: result.sourceEvidence.length,
    evidences: result.sourceEvidence,
  });
  writeUtf8Json(
    path.join(outDir, "ingredient-conflicts.json"),
    result.ingredientConflicts
  );
  writeUtf8Json(
    path.join(outDir, "duplicate-merge-report.json"),
    result.duplicateMergeReport
  );
  writeUtf8Json(
    path.join(outDir, "readiness-report.json"),
    result.readinessReport
  );
  writeUtf8Json(path.join(outDir, "reuse-analysis.json"), result.reuseAnalysis);
  writeUtf8Json(path.join(outDir, "manifest.json"), result.manifest);
}

/**
 * D/E scenario pilot enrichment (dry-run only).
 * Layers DE evidence overlay + pool replacements on base enrichment pack.
 */

import fs from "node:fs";
import path from "node:path";
import {
  runPilotEnrichment,
  writeEnrichmentArtifacts,
  type EnrichmentResult,
  type EvidencePack,
  type EvidencePackProduct,
  type PilotCandidate,
} from "./pilotEnrichment";

const DE_SCENARIOS = [
  "kr-uv-sunscreen-sensitive",
  "kr-aging-eye-cream",
] as const;

export type DeCandidateAdd = {
  productIdentity: string;
  scenarioId: (typeof DE_SCENARIOS)[number];
  brand: string;
  normalizedProductName: string;
  category: string;
  roleTags: string[];
  cautionIngredients?: string[];
  volumeLabel?: string | null;
  regionalSku?: "KR" | "US" | "GLOBAL";
  spfPa?: string | null;
  fitNotes?: string;
};

export type DePoolReplacement = {
  out: string;
  in: string;
  reason: string;
};

export type DeEvidenceOverlay = {
  packDate: string;
  notes?: string[];
  productPatches: EvidencePackProduct[];
  candidateAdds?: DeCandidateAdd[];
  poolReplacements?: Partial<Record<(typeof DE_SCENARIOS)[number], DePoolReplacement[]>>;
};

export type DeEnrichmentOptions = {
  pilotDir: string;
  baseEvidencePackPath: string;
  deOverlayPath: string;
  outDir: string;
  brandCapDefault?: number;
  baselineEnrichmentDir?: string;
};

export type CandidateReplacementReport = {
  generatedAt: string;
  scenarios: Record<
    string,
    {
      replacements: DePoolReplacement[];
      priorReady: number;
      finalReady: number;
    }
  >;
  notes: string[];
};

export type DeEnrichmentResult = EnrichmentResult & {
  candidateReplacementReport: CandidateReplacementReport;
  baselineComparison?: {
    priorDeReady: Record<string, number>;
    finalDeReady: Record<string, number>;
    priorTotalReady: number;
    finalTotalReady: number;
  };
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, { encoding: "utf8" })) as T;
}

function writeUtf8Json(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", {
    encoding: "utf8",
  });
}

function patchProduct(
  base: EvidencePackProduct,
  patch: EvidencePackProduct
): EvidencePackProduct {
  return {
    ...base,
    ...patch,
    ingredients: patch.ingredients ?? base.ingredients,
    images: patch.images ?? base.images,
    offers: patch.offers ?? base.offers,
    sourceEvidences: patch.sourceEvidences ?? base.sourceEvidences,
    cautionIngredients: patch.cautionIngredients ?? base.cautionIngredients,
    criticalConflict:
      patch.criticalConflict !== undefined
        ? patch.criticalConflict
        : base.criticalConflict,
    unavailable:
      patch.unavailable !== undefined ? patch.unavailable : base.unavailable,
  };
}

export function mergeDeEvidencePack(
  base: EvidencePack,
  overlay: DeEvidenceOverlay
): EvidencePack {
  const byId = new Map(
    base.products.map((p) => [p.productIdentity, { ...p }] as const)
  );
  for (const patch of overlay.productPatches) {
    const existing = byId.get(patch.productIdentity);
    byId.set(
      patch.productIdentity,
      existing ? patchProduct(existing, patch) : patch
    );
  }
  return {
    ...base,
    packDate: overlay.packDate,
    notes: [...(base.notes ?? []), ...(overlay.notes ?? [])],
    products: [...byId.values()],
  };
}

export function applyPoolReplacements(
  basePlan: Record<string, string[]>,
  replacements: Partial<Record<string, DePoolReplacement[]>>
): { plan: Record<string, string[]>; applied: Record<string, DePoolReplacement[]> } {
  const plan: Record<string, string[]> = {};
  const applied: Record<string, DePoolReplacement[]> = {};
  for (const [sid, ids] of Object.entries(basePlan)) {
    plan[sid] = [...ids];
  }
  for (const sid of DE_SCENARIOS) {
    const reps = replacements[sid] ?? [];
    applied[sid] = [];
    if (!plan[sid]) continue;
    for (const rep of reps) {
      const idx = plan[sid].indexOf(rep.out);
      if (idx >= 0) {
        plan[sid][idx] = rep.in;
        applied[sid].push(rep);
      }
    }
  }
  return { plan, applied };
}

function toPilotCandidate(add: DeCandidateAdd): PilotCandidate {
  return {
    productIdentity: add.productIdentity,
    brand: add.brand,
    normalizedProductName: add.normalizedProductName,
    category: add.category,
    roleTags: add.roleTags,
    cautionIngredients: add.cautionIngredients ?? [],
    affiliateOrAdInScore: false,
    scenarioFit: {
      fitNotes:
        add.fitNotes ??
        `DE enrichment candidate (${add.regionalSku ?? "GLOBAL"} SKU).`,
      fitScore: 0.75,
    },
  };
}

function countScenarioReady(
  result: EnrichmentResult,
  scenarioId: string
): number {
  return (
    result.readinessReport.perScenario[scenarioId]?.recommendation_ready ?? 0
  );
}

export function runPilotDeEnrichment(
  opts: DeEnrichmentOptions
): DeEnrichmentResult {
  const base = readJson<EvidencePack>(opts.baseEvidencePackPath);
  const overlay = readJson<DeEvidenceOverlay>(opts.deOverlayPath);
  const merged = mergeDeEvidencePack(base, overlay);

  const basePlan = base.poolSlotPlan;
  if (!basePlan) {
    throw new Error("Base evidence pack missing poolSlotPlan");
  }

  const { plan: poolSlotPlanOverride, applied } = applyPoolReplacements(
    basePlan,
    overlay.poolReplacements ?? {}
  );

  for (const sid of DE_SCENARIOS) {
    const reps = overlay.poolReplacements?.[sid] ?? [];
    if (reps.length > 2) {
      throw new Error(`${sid}: more than 2 pool replacements`);
    }
  }

  const mergedPackPath = path.join(opts.outDir, "_merged-evidence-pack.json");
  fs.mkdirSync(opts.outDir, { recursive: true });
  writeUtf8Json(mergedPackPath, merged);

  const extraCandidatesByScenario: Record<string, PilotCandidate[]> = {};
  for (const add of overlay.candidateAdds ?? []) {
    if (!extraCandidatesByScenario[add.scenarioId]) {
      extraCandidatesByScenario[add.scenarioId] = [];
    }
    extraCandidatesByScenario[add.scenarioId].push(toPilotCandidate(add));
  }

  let priorDeReady: Record<string, number> = {};
  let priorTotalReady = 0;
  if (opts.baselineEnrichmentDir) {
    const baselineReport = readJson<{
      perScenario: Record<string, { recommendation_ready: number }>;
      recommendationReadyTotal: number;
    }>(path.join(opts.baselineEnrichmentDir, "readiness-report.json"));
    priorTotalReady = baselineReport.recommendationReadyTotal;
    for (const sid of DE_SCENARIOS) {
      priorDeReady[sid] =
        baselineReport.perScenario[sid]?.recommendation_ready ?? 0;
    }
  }

  const result = runPilotEnrichment({
    pilotDir: opts.pilotDir,
    evidencePackPath: mergedPackPath,
    outDir: opts.outDir,
    brandCapDefault: opts.brandCapDefault ?? 2,
    extraCandidatesByScenario,
    poolSlotPlanOverride,
  });

  const finalDeReady: Record<string, number> = {};
  for (const sid of DE_SCENARIOS) {
    finalDeReady[sid] = countScenarioReady(result, sid);
  }

  const candidateReplacementReport: CandidateReplacementReport = {
    generatedAt: new Date().toISOString(),
    scenarios: {},
    notes: overlay.notes ?? [],
  };
  for (const sid of DE_SCENARIOS) {
    candidateReplacementReport.scenarios[sid] = {
      replacements: applied[sid] ?? [],
      priorReady: priorDeReady[sid] ?? 0,
      finalReady: finalDeReady[sid] ?? 0,
    };
  }

  return {
    ...result,
    candidateReplacementReport,
    baselineComparison: opts.baselineEnrichmentDir
      ? {
          priorDeReady,
          finalDeReady,
          priorTotalReady,
          finalTotalReady: result.readinessReport.recommendationReadyTotal,
        }
      : undefined,
    manifest: {
      ...result.manifest,
      enrichmentKind: "scenario-pilot-de",
      baseEvidencePackPath: opts.baseEvidencePackPath,
      deOverlayPath: opts.deOverlayPath,
      mergedEvidencePackPath: mergedPackPath,
      deScenarios: [...DE_SCENARIOS],
      candidateReplacements: applied,
    },
  };
}

export function writeDeEnrichmentArtifacts(
  result: DeEnrichmentResult,
  outDir: string
): void {
  writeEnrichmentArtifacts(result, outDir);
  writeUtf8Json(
    path.join(outDir, "candidate-replacement-report.json"),
    result.candidateReplacementReport
  );
  if (result.baselineComparison) {
    writeUtf8Json(
      path.join(outDir, "baseline-comparison.json"),
      result.baselineComparison
    );
  }
  writeUtf8Json(path.join(outDir, "manifest.json"), result.manifest);
}

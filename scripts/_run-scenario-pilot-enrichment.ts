/**
 * TS entry for scenario pilot enrichment dry-run.
 */
import path from "node:path";
import {
  runPilotEnrichment,
  writeEnrichmentArtifacts,
} from "../src/lib/catalog/multiSource/pilotEnrichment";

const root = process.cwd();
const pilotDir = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot",
  "2026-07-22"
);
const evidencePackPath = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot-enrichment",
  "2026-07-22",
  "_evidence-pack.json"
);
const outDir = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot-enrichment",
  "2026-07-22"
);

const result = runPilotEnrichment({
  pilotDir,
  evidencePackPath,
  outDir,
  brandCapDefault: 2,
});
writeEnrichmentArtifacts(result, outDir);

console.log(
  JSON.stringify(
    {
      uniqueProducts: result.reuseAnalysis.uniqueProducts,
      reuseRate: result.reuseAnalysis.reuseRate,
      metReuseTarget: result.reuseAnalysis.metTarget,
      recommendationReadyTotal:
        result.readinessReport.recommendationReadyTotal,
      shortfallNotes: result.readinessReport.shortfallNotes,
      outDir,
    },
    null,
    2
  )
);

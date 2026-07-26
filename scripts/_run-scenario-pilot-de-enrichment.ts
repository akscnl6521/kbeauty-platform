/**
 * TS entry for D/E scenario pilot enrichment dry-run.
 */
import path from "node:path";
import {
  runPilotDeEnrichment,
  writeDeEnrichmentArtifacts,
} from "../src/lib/catalog/multiSource/pilotDeEnrichment";

const root = process.cwd();
const pilotDir = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot",
  "2026-07-22"
);
const baseEvidencePackPath = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot-enrichment",
  "2026-07-22",
  "_evidence-pack.json"
);
const deOverlayPath = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot-enrichment-de",
  "2026-07-22",
  "_de-evidence-overlay.json"
);
const baselineEnrichmentDir = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot-enrichment",
  "2026-07-22"
);
const outDir = path.join(
  root,
  "data",
  "catalog",
  "scenario-pilot-enrichment-de",
  "2026-07-22"
);

const result = runPilotDeEnrichment({
  pilotDir,
  baseEvidencePackPath,
  deOverlayPath,
  baselineEnrichmentDir,
  outDir,
  brandCapDefault: 2,
});
writeDeEnrichmentArtifacts(result, outDir);

console.log(
  JSON.stringify(
    {
      priorTotalReady: result.baselineComparison?.priorTotalReady,
      finalTotalReady: result.baselineComparison?.finalTotalReady,
      priorDeReady: result.baselineComparison?.priorDeReady,
      finalDeReady: result.baselineComparison?.finalDeReady,
      shortfallNotes: result.readinessReport.shortfallNotes,
      replacements: result.candidateReplacementReport.scenarios,
      outDir,
    },
    null,
    2
  )
);

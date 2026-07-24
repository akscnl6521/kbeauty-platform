/**
 * Machine-readable audit artifact for T07-03 enrichment.
 */

import type {
  InstitutionDetailAuditArtifact,
  InstitutionDetailEnrichmentMode,
  InstitutionDetailEnrichmentTotals,
  InstitutionEnrichedCandidate,
  EnrichmentCheckpoint,
} from "./types";
import { INSTITUTION_DETAIL_ENRICHMENT_TASK_ID } from "./types";

export function emptyEnrichmentTotals(): InstitutionDetailEnrichmentTotals {
  return {
    inputCandidates: 0,
    processed: 0,
    enriched: 0,
    partial: 0,
    failedRetryable: 0,
    failedTerminal: 0,
    needsManualReview: 0,
    cacheHits: 0,
    dermatologyOfficialTrue: 0,
    dermatologyOfficialFalse: 0,
    dermatologyOfficialUnknown: 0,
    specialistCountKnown: 0,
    specialistCountUnknown: 0,
    conflicts: 0,
  };
}

export function accumulateTotals(
  totals: InstitutionDetailEnrichmentTotals,
  row: InstitutionEnrichedCandidate,
): void {
  totals.processed += 1;
  if (row.status === "enriched" || row.status === "skipped_cached") {
    totals.enriched += 1;
  }
  if (row.status === "partial") totals.partial += 1;
  if (row.status === "failed_retryable") totals.failedRetryable += 1;
  if (row.status === "failed_terminal") totals.failedTerminal += 1;
  if (row.status === "needs_manual_review") totals.needsManualReview += 1;
  if (row.cacheHit) totals.cacheHits += 1;

  const flag = row.dermatologistEvidence.dermatologyDeptOfficial;
  if (flag === true) totals.dermatologyOfficialTrue += 1;
  else if (flag === false) totals.dermatologyOfficialFalse += 1;
  else totals.dermatologyOfficialUnknown += 1;

  if (row.dermatologistEvidence.dermatologySpecialistCount != null) {
    totals.specialistCountKnown += 1;
  } else if (flag === true) {
    totals.specialistCountUnknown += 1;
  }

  if (row.dermatologistEvidence.conflictingSourceState === "conflict") {
    totals.conflicts += 1;
  }
}

export function buildEnrichmentAuditArtifact(input: {
  runId: string;
  mode: InstitutionDetailEnrichmentMode;
  generatedAt: string;
  checkpoint: EnrichmentCheckpoint;
  totals: InstitutionDetailEnrichmentTotals;
  candidates: InstitutionEnrichedCandidate[];
  safeEndpoint: string | null;
  ok: boolean;
  notesKo: string[];
}): InstitutionDetailAuditArtifact {
  return {
    taskId: INSTITUTION_DETAIL_ENRICHMENT_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok: input.ok,
    checkpoint: input.checkpoint,
    totals: input.totals,
    sampleEnriched: input.candidates.slice(0, 12).map((c) => ({
      candidateId: c.candidateId,
      institutionId: c.institutionId,
      status: c.status,
      evidenceStrength: c.dermatologistEvidence.evidenceStrength,
      dermatologyDeptOfficial: c.dermatologistEvidence.dermatologyDeptOfficial,
      dermatologySpecialistCount:
        c.dermatologistEvidence.dermatologySpecialistCount,
      conflictingSourceState: c.dermatologistEvidence.conflictingSourceState,
      manualReviewReasons: c.manualReviewReasons,
    })),
    safeEndpoint: input.safeEndpoint,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    notesKo: input.notesKo,
  };
}

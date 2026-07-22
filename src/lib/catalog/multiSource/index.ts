export type {
  SourceTrustTier,
  IngredientEvidenceStatus,
  ProductReadinessState,
  MultiSourceChannel,
  SourceFetchOutcome,
  SourceEvidence,
  IngredientEvidence,
  OfferEvidence,
  ImageEvidence,
  ProductIdentity,
  MergedMultiSourceProduct,
} from "./types";

export {
  trustForChannel,
  canFinalizeIngredients,
  channelLabel,
  trustTierRank,
  preferHigherTrust,
} from "./sourceTrust";

export { inciSimilarity, mergeIngredientStatus } from "./ingredientMerge";

export {
  normalizeBrand,
  normalizeProductName,
  buildProductId,
  nameSimilarity,
  maybeSameProduct,
} from "./productIdentity";

export { promoteReadiness } from "./readinessPromote";
export type {
  ReadinessPromoteInput,
  ReadinessPromoteResult,
} from "./readinessPromote";

export {
  runPilotEnrichment,
  writeEnrichmentArtifacts,
} from "./pilotEnrichment";
export type {
  EnrichmentOptions,
  EnrichmentResult,
  EvidencePack,
  PilotPoolFile,
} from "./pilotEnrichment";

export {
  runPilotDeEnrichment,
  writeDeEnrichmentArtifacts,
  mergeDeEvidencePack,
  applyPoolReplacements,
} from "./pilotDeEnrichment";
export type {
  DeEnrichmentOptions,
  DeEnrichmentResult,
  DeEvidenceOverlay,
  DePoolReplacement,
  CandidateReplacementReport,
} from "./pilotDeEnrichment";

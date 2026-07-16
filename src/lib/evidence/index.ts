export {
  applyEvidenceToRecommendation,
  evidenceForMatchedIngredients,
} from "./applyEvidenceToRecommendation";
export {
  guidanceForConcernLabels,
  mergeConcernGuidanceIntoLists,
} from "./concernGuidance";
export { resolveApprovedEvidenceForConcerns } from "./loadApprovedEvidence";
export {
  listEvidenceCatalogConcerns,
  listEvidenceCatalogEntries,
  loadStaticApprovedEvidenceForConcerns,
} from "./staticCatalog";
export type {
  ApprovedEvidenceLink,
  EvidenceLevel,
  EvidenceType,
} from "./types";
export {
  evidenceCitationHref,
  evidenceLevelLabelKo,
  isCoreEvidenceLevel,
} from "./types";
export {
  getHairConcernGuidance,
  getMakeupAttributeGuidance,
  hairGuidanceFor,
} from "./makeupHairGuidance";

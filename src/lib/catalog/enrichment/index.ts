export {
  classifyProvenance,
  enrichOfficialUrl,
  robotsAllowsPath,
  stagingStatusFor,
  type EnrichmentMatchClass,
  type EnrichmentRecord,
  type BrandCheckpoint,
} from "./enrichOfficial";
export {
  extractLabeledIngredientsRaw,
  extractOpenGraph,
} from "./extractLabeledIngredients";
export {
  OFFICIAL_URL_OVERRIDES,
  resolveOfficialUrlOverride,
} from "./officialUrlOverrides";
export { applyIdentityDecisions } from "./applyIdentityDecisions";

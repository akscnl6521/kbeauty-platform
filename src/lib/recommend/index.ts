export type {
  AnalysisResult,
  CandidateProduct,
  FetchCandidateProductsOptions,
  RankableProduct,
  RankedProduct,
  Recommendation,
} from "./types";
export {
  ANALYSIS_RESULT_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RANKED_PRODUCTS_TOP_N,
  RECOMMENDATION_STORAGE_KEY,
} from "./types";
export {
  normalizeAnalysisResult,
  parseAnalysisTextToRecommendation,
  toRecommendation,
} from "./parseAnalysis";
export {
  coerceIngredientList,
  coerceIngredientListUnknown,
  debugNormalizeIngredients,
  findMatchByCanonical,
  findMatchingIngredient,
  indexIngredients,
  normalizeIngredient,
  normalizeIngredientKey,
  toCanonical,
} from "./normalizeIngredient";
export { INGREDIENT_ALIAS_GROUPS } from "./ingredientAliases";
export { rankProducts } from "./rankProducts";
export {
  fetchCandidateProducts,
  mapRowToCandidateProduct,
} from "./fetchCandidateProducts";
export {
  clearPersistedRankedProducts,
  persistTopRankedProducts,
} from "./persistTopRankedProducts";
export {
  createMockRecommendation,
  MOCK_RECOMMENDATION,
} from "./mockRecommendation";
export { loadRankedProductsFromStorage } from "./loadRankedProducts";
export {
  auditIngredientFormats,
  logIngredientFormatAudit,
} from "./auditIngredientFormats";
export type {
  IngredientAuditRow,
  IngredientFormatAuditSummary,
} from "./auditIngredientFormats";

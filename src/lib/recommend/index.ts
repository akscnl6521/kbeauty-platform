export type {
  AnalysisResult,
  CandidateProduct,
  CurrentProductInput,
  CurrentProductReaction,
  CurrentProductUsageTime,
  FetchCandidateProductsOptions,
  ManagementLevel,
  RankableProduct,
  RankedProduct,
  Recommendation,
} from "./types";
export type {
  CatalogProduct,
  DataConfidence,
  KoreanProductInput,
  KoreanProductOfferInput,
  ProductOffer,
  ProductStatus,
  RetailerType,
  StockStatus,
} from "./catalogTypes";
export {
  filterPublicCatalogProducts,
  filterOutStimulatingActives,
  hasStimulatingActives,
  isExcludedFromPublicCatalog,
} from "./publicCatalogFilter";
export { buildMatchReason, buildEvidenceCitationItems } from "./buildMatchReason";
export { CATALOG_DATA_GOALS, CORE_ALLOWED_STOCK } from "./catalogTypes";
export {
  filterCandidatesByOfferAvailability,
  isOfferEligibleForCoreRecommendation,
  isOfferEligibleForRecommendation,
  isOfferPurchasableForCta,
  normalizeCatalogProduct,
  normalizeProductOffer,
  productOfferToPurchaseLink,
  resolveProductOffers,
} from "./productOffer";
export type { OfferFilterResult } from "./productOffer";
export {
  commerceFitButUnavailableMessageKo,
  commerceStatusLabelEn,
  commerceStatusLabelKo,
  deriveCommerceAvailability,
  isRecommendCommerceSeparationEnabled,
  stockStatusToCommerceStatus,
} from "./commerceStatus";
export type {
  CommerceAvailability,
  CommerceStatus,
} from "./commerceStatus";
export {
  findDuplicateBrandProductNames,
  findDuplicateProducts,
} from "./findDuplicateProducts";
export type {
  DuplicateIdIssue,
  DuplicateProductGroup,
  DuplicateScanResult,
} from "./findDuplicateProducts";
export {
  isSampleOrUnverifiedProduct,
  meetsKoreanVerifiedOfferRules,
  parseOptionalBoolean,
  parseOptionalNumber,
  parsePipeList,
  rowToKoreanProductInput,
  rowToKoreanProductOfferInput,
  validateCatalogData,
  validateKoreanProduct,
  validateKoreanProductOffer,
} from "./validateCatalogData";
export type {
  CatalogValidationIssue,
  CatalogValidationReport,
  CatalogValidationSeverity,
} from "./validateCatalogData";
export {
  ANALYSIS_RESULT_STORAGE_KEY,
  ANALYZE_SOURCE_STORAGE_KEY,
  CORE_RECOMMEND_OFFER_COUNTRY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RANKED_PRODUCTS_TOP_N,
  RECOMMENDATION_CACHE_VERSION,
  RECOMMENDATION_CACHE_VERSION_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "./types";
export {
  mergeCurrentRoutineIntoRecommendation,
  normalizeCurrentProducts,
  reviewCurrentRoutine,
} from "./currentProduct";
export type { CurrentRoutineReview } from "./currentProduct";
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
export {
  displayIngredientName,
  displayIngredientNames,
  getIngredientCanonicalKey,
  getIngredientDisplayName,
  isMoreSpecificIngredientLabel,
} from "./displayIngredientName";
export type { IngredientDisplayLocale } from "./displayIngredientName";
export { getRetailerDisplayName } from "./getRetailerDisplayName";
export {
  displayProductFormLabel,
  formatProductSizeLabel,
  getProductTrustStatus,
  parseSizeFromProductName,
  productTrustStatusLabel,
  stripTrailingSizeFromProductName,
} from "./displayProductMeta";
export type {
  ParsedProductSize,
  ProductTrustStatus,
} from "./displayProductMeta";
export { getShippingCountryLabel } from "./getShippingCountryLabel";
export { rankProducts } from "./rankProducts";
export { toCanonicalConcern } from "./concernAliases";
export {
  filterRankedByMatchEvidence,
  hasCoreRecommendMatchEvidence,
} from "./filterRankedByMatchEvidence";
export { formatVerifiedAtForDisplay } from "./formatVerifiedAt";
export { applyUserIngredientPreferences } from "./applyUserIngredientPreferences";
export { filterCandidatesBySafety } from "./filterCandidatesBySafety";
export type { SafetyFilterResult } from "./filterCandidatesBySafety";
export { asConcernOrToneField } from "./asConcernOrToneField";
export {
  fetchCandidateProducts,
  fetchOffersByProductIds,
  mapRowToCandidateProduct,
} from "./fetchCandidateProducts";
export {
  clearPersistedRankedProducts,
  persistTopRankedProducts,
} from "./persistTopRankedProducts";
export type { PersistTopRankedOptions } from "./persistTopRankedProducts";
export {
  createMockRecommendation,
  MOCK_RECOMMENDATION,
} from "./mockRecommendation";
export { loadRankedProductsFromStorage } from "./loadRankedProducts";
export {
  discardStaleRankedProductsCache,
  filterRankedProductsByKrVerifiedOffer,
  isRecommendationCacheVersionCurrent,
  productHasKrVerifiedCoreOffer,
  writeRecommendationCacheVersion,
} from "./recommendationCache";
export {
  enrichRecommendationWithAnalysis,
  loadAnalysisResultFromStorage,
  loadLatestRecommendationPipeline,
  loadRecommendationFromStorage,
  purgeLegacyRecommendationCaches,
  RECOMMENDATION_SOURCE_KEYS,
} from "./loadRecommendation";
export type { RecommendationPipelineSnapshot } from "./loadRecommendation";
export {
  auditIngredientFormats,
  logIngredientFormatAudit,
} from "./auditIngredientFormats";
export type {
  IngredientAuditRow,
  IngredientFormatAuditSummary,
} from "./auditIngredientFormats";
export { selectPurchaseLink } from "./selectCandidatePurchaseLink";
export type { PurchaseLinkSelection } from "./selectPurchaseLink";
export {
  buildPurchaseLinksFromProduct,
  formatOfferPrice,
  normalizeShippingCountry,
  selectPurchaseLinkForCountry,
  selectPurchaseLinkForCountryWithDebug,
} from "./selectPurchaseLink";
export type {
  LegacyPurchaseLinkFields,
  LinkVerificationStatus,
  OfferCurrency,
  PurchaseLink,
  RetailerCountry,
  SelectPurchaseLinkDebug,
  ShippingCountry,
} from "./selectPurchaseLink";
export {
  countPurchaseLinkCoverage,
  logPurchaseLinkCoverage,
  logTopProductPurchaseLinkAudit,
} from "./auditPurchaseLinks";

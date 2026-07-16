/**
 * Thin re-export of anonymous local-store helpers.
 */

export {
  CARE_STORAGE_KEY,
  loadCareStore,
  saveCareStore,
  saveAnalysisSessionFromLocalRecommendation,
  completeCheckIn,
  refreshCareDueState,
  emptyCareStore,
} from "@/lib/care/local-store";

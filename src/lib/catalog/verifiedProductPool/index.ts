/**
 * P3-T02 Verified product pool and category expansion — public exports.
 */

export * from "./types";
export * from "./constants";
export * from "./categoryNormalize";
export * from "./rejectionReasons";
export * from "./eligibility";
export * from "./dedupeMerge";
export * from "./top5Gate";
export * from "./fixtures";
export * from "./audit";
export {
  mapRawToPoolCandidate,
  runVerifiedPoolExpansion,
  runFixtureVerifiedPoolExpansion,
} from "./pipeline";
export type { RunVerifiedPoolExpansionInput } from "./pipeline";

/**
 * P3-T01 Official Korean product source onboarding — public exports.
 */

export * from "./types";
export * from "./constants";
export * from "./sourceManifest";
export * from "./fieldProvenance";
export * from "./dedupe";
export * from "./stalePolicy";
export * from "./checkpoint";
export * from "./reviewReasons";
export * from "./eligibility";
export * from "./fixtures";
export * from "./mapCandidate";
export * from "./audit";
export {
  runOfficialKrProductIngestion,
  runFixtureOfficialKrProductIngestion,
} from "./pipeline";
export type { RunOfficialKrProductIngestionInput } from "./pipeline";

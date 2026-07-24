/**
 * P3-T02 constants.
 */

import type { VerifiedPoolCategory } from "./types";
import { VERIFIED_POOL_CATEGORIES } from "./types";

/** Public Top 5 hard limit. */
export const PUBLIC_TOP5_LIMIT = 5;

export const SAFE_ENDPOINT_NOTE =
  "offline://verified-product-pool-manifest" as const;

/** Safety flags that block ordinary cosmetic recommendation. */
export const BLOCKING_SAFETY_FLAGS = [
  "acute_eye_injury",
  "open_wound",
  "medical_device_only",
  "professional_only",
  "red_flag_symptom",
] as const;

export function emptyCategoryCounts(): Record<VerifiedPoolCategory, number> {
  return Object.fromEntries(
    VERIFIED_POOL_CATEGORIES.map((c) => [c, 0]),
  ) as Record<VerifiedPoolCategory, number>;
}

/**
 * P3-T01 constants — refresh windows · blocked access · safe notes.
 */

import type { SourceAccessMode } from "./types";

/** Offer / price / stock refresh queue (days). */
export const OFFER_REFRESH_MAX_AGE_DAYS = 30;

/** Product meta / INCI refresh queue (days). */
export const PRODUCT_REFRESH_MAX_AGE_DAYS = 90;

/** Beyond this → block publish / mark stale. */
export const PRODUCT_STALE_MAX_AGE_DAYS = 180;

export const DEFAULT_MANIFEST_SLICE_SIZE = 5;

export const BLOCKED_ACCESS_MODES: readonly SourceAccessMode[] = [
  "blocked_auth_required",
  "blocked_paid_api",
  "blocked_captcha",
  "blocked_terms_risk",
] as const;

export const SAFE_ENDPOINT_NOTE =
  "offline://official-kr-product-manifest" as const;

/** Required field keys for staging-review readiness (unknown stays unknown). */
export const CORE_FIELD_KEYS = [
  "brandName",
  "productNameKo",
  "fullIngredients",
  "brandOfficialUrl",
] as const;

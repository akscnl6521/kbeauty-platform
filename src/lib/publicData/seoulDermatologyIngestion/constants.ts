/**
 * Official HIRA filter constants for Seoul dermatology ingestion (T07-02).
 */

import {
  DEFAULT_DEPARTMENT_INFO_OP,
  DEFAULT_HOSP_BASIS_LIST_OP,
  DEFAULT_HOSP_INFO_BASE_URL,
  DEFAULT_INST_DETAIL_BASE_URL,
  SEOUL_SIDO_CD,
  joinServiceOperation,
} from "../config";

export { SEOUL_SIDO_CD };

/**
 * HIRA 진료과목코드 — 피부과.
 * Primary official code used by hospInfoServicev2 `dgsbjtCd` filter is `14`.
 * Name match on official `dgsbjtCdNm` remains authoritative when present.
 */
export const HIRA_DERMATOLOGY_DEPT_CODES = ["14"] as const;

/** Official department name token (not a marketing keyword alone). */
export const HIRA_DERMATOLOGY_DEPT_NAME = "피부과" as const;

/** Default page size for resumable pagination. */
export const DEFAULT_INGESTION_PAGE_SIZE = 10;

/** Candidate evidence older than this → mark stale / block publish. */
export const CANDIDATE_STALE_MAX_AGE_DAYS = 180;

/** Evidence older than this → queue refresh (still usable as candidate). */
export const CANDIDATE_REFRESH_MAX_AGE_DAYS = 90;

export const HIRA_HOSP_LIST_SAFE_URL = joinServiceOperation(
  DEFAULT_HOSP_INFO_BASE_URL,
  DEFAULT_HOSP_BASIS_LIST_OP,
);

export const HIRA_DEPT_INFO_SAFE_URL = joinServiceOperation(
  DEFAULT_INST_DETAIL_BASE_URL,
  DEFAULT_DEPARTMENT_INFO_OP,
);

export const SEOUL_NAME_TOKENS = ["서울", "서울특별시"] as const;

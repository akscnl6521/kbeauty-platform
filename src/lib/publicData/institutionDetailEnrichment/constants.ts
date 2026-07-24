/**
 * Official HIRA constants for institution detail enrichment (T07-03).
 */

import {
  DEFAULT_DEPARTMENT_INFO_OP,
  DEFAULT_FACILITY_INFO_OP,
  DEFAULT_INST_DETAIL_BASE_URL,
  joinServiceOperation,
} from "../config";
import {
  HIRA_DERMATOLOGY_DEPT_CODES,
  HIRA_DERMATOLOGY_DEPT_NAME,
} from "../seoulDermatologyIngestion/constants";

export {
  HIRA_DERMATOLOGY_DEPT_CODES,
  HIRA_DERMATOLOGY_DEPT_NAME,
};

/** Default bounded concurrency for detail lookups. */
export const DEFAULT_ENRICHMENT_CONCURRENCY = 3;

/** Soft cap — never exceed this even if caller asks higher. */
export const MAX_ENRICHMENT_CONCURRENCY = 8;

/** Cache TTL for detail responses within a run / resume (hours). */
export const DETAIL_CACHE_TTL_HOURS = 24;

export const HIRA_DEPT_INFO_SAFE_URL = joinServiceOperation(
  DEFAULT_INST_DETAIL_BASE_URL,
  DEFAULT_DEPARTMENT_INFO_OP,
);

export const HIRA_FACILITY_INFO_SAFE_URL = joinServiceOperation(
  DEFAULT_INST_DETAIL_BASE_URL,
  DEFAULT_FACILITY_INFO_OP,
);

export const SYMPTOM_EXPERTISE_SEPARATION_NOTE_KO =
  "기관상세(HIRA 진료과목·전문의 수)만으로는 증상별 전문 주장을 채우지 않습니다. 피부과 전문의 근거와 증상 전문 주장은 분리됩니다.";

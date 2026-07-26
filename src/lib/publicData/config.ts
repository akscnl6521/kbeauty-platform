/**
 * Configurable HIRA / data.go.kr endpoints for T07-01.
 * Base URLs and operation names can be overridden via env without code changes.
 */

import type { PublicDataApiMode, PublicDataClientConfig } from "./types";

/** Official HIRA hospital information service (data.go.kr). */
export const DEFAULT_HOSP_INFO_BASE_URL =
  "https://apis.data.go.kr/B551182/hospInfoServicev2";

/** Official HIRA medical institution detail service (data.go.kr). */
export const DEFAULT_INST_DETAIL_BASE_URL =
  "https://apis.data.go.kr/B551182/MadmDtlInfoService2.8";

export const DEFAULT_HOSP_BASIS_LIST_OP = "getHospBasisList";
export const DEFAULT_FACILITY_INFO_OP = "getFacilityInfo2.8";
export const DEFAULT_DEPARTMENT_INFO_OP = "getDgsbjtInfo2.8";

/** Seoul (서울특별시) sido code used by HIRA hospital list. */
export const SEOUL_SIDO_CD = "110000";

export const DEFAULT_PUBLIC_DATA_CLIENT_CONFIG: PublicDataClientConfig = {
  mode: "live",
  timeoutMs: 12_000,
  maxAttempts: 3,
  retryBaseDelayMs: 400,
  retryMaxDelayMs: 4_000,
  hospitalInfo: {
    baseUrl: DEFAULT_HOSP_INFO_BASE_URL,
    operations: {
      basisList: DEFAULT_HOSP_BASIS_LIST_OP,
    },
  },
  institutionDetail: {
    baseUrl: DEFAULT_INST_DETAIL_BASE_URL,
    operations: {
      facilityInfo: DEFAULT_FACILITY_INFO_OP,
      departmentInfo: DEFAULT_DEPARTMENT_INFO_OP,
    },
  },
};

function readEnvString(
  env: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const v = env[name];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function readEnvInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = readEnvString(env, name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function resolvePublicDataApiMode(
  env: NodeJS.ProcessEnv = process.env,
  override?: PublicDataApiMode,
): PublicDataApiMode {
  if (override) return override;
  const raw =
    readEnvString(env, "PUBLIC_DATA_API_MODE") ??
    readEnvString(env, "DATA_GO_KR_API_MODE");
  if (raw === "fixture" || raw === "live") return raw;
  return "live";
}

export function loadPublicDataClientConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides?: Partial<PublicDataClientConfig>,
): PublicDataClientConfig {
  const base: PublicDataClientConfig = {
    mode: resolvePublicDataApiMode(env, overrides?.mode),
    timeoutMs:
      overrides?.timeoutMs ??
      readEnvInt(env, "DATA_GO_KR_TIMEOUT_MS", DEFAULT_PUBLIC_DATA_CLIENT_CONFIG.timeoutMs),
    maxAttempts:
      overrides?.maxAttempts ??
      readEnvInt(
        env,
        "DATA_GO_KR_MAX_ATTEMPTS",
        DEFAULT_PUBLIC_DATA_CLIENT_CONFIG.maxAttempts,
      ),
    retryBaseDelayMs:
      overrides?.retryBaseDelayMs ??
      readEnvInt(
        env,
        "DATA_GO_KR_RETRY_BASE_MS",
        DEFAULT_PUBLIC_DATA_CLIENT_CONFIG.retryBaseDelayMs,
      ),
    retryMaxDelayMs:
      overrides?.retryMaxDelayMs ??
      readEnvInt(
        env,
        "DATA_GO_KR_RETRY_MAX_MS",
        DEFAULT_PUBLIC_DATA_CLIENT_CONFIG.retryMaxDelayMs,
      ),
    hospitalInfo: {
      baseUrl:
        overrides?.hospitalInfo?.baseUrl ??
        readEnvString(env, "DATA_GO_KR_HOSP_INFO_BASE_URL") ??
        DEFAULT_HOSP_INFO_BASE_URL,
      operations: {
        basisList:
          overrides?.hospitalInfo?.operations?.basisList ??
          readEnvString(env, "DATA_GO_KR_HOSP_BASIS_LIST_OP") ??
          DEFAULT_HOSP_BASIS_LIST_OP,
      },
    },
    institutionDetail: {
      baseUrl:
        overrides?.institutionDetail?.baseUrl ??
        readEnvString(env, "DATA_GO_KR_INST_DETAIL_BASE_URL") ??
        DEFAULT_INST_DETAIL_BASE_URL,
      operations: {
        facilityInfo:
          overrides?.institutionDetail?.operations?.facilityInfo ??
          readEnvString(env, "DATA_GO_KR_INST_FACILITY_OP") ??
          DEFAULT_FACILITY_INFO_OP,
        departmentInfo:
          overrides?.institutionDetail?.operations?.departmentInfo ??
          readEnvString(env, "DATA_GO_KR_INST_DEPT_OP") ??
          DEFAULT_DEPARTMENT_INFO_OP,
      },
    },
  };
  return base;
}

export function joinServiceOperation(
  baseUrl: string,
  operation: string,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const op = operation.replace(/^\/+/, "");
  return `${base}/${op}`;
}

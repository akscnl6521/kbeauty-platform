/**
 * T07-01 — Public data API contract types (HIRA / data.go.kr).
 * Never store or log authenticated request URLs or service keys.
 */

export const PUBLIC_DATA_API_TASK_ID = "T07-01" as const;

export type PublicDataApiMode = "live" | "fixture";

export type PublicDataServiceId = "hira_hospital_info" | "hira_institution_detail";

export type PublicDataOperationId =
  | "hospital_basis_list"
  | "institution_facility_info"
  | "institution_department_info";

export type PublicDataErrorCode =
  | "missing_service_key"
  | "invalid_config"
  | "timeout"
  | "network"
  | "http_error"
  | "rate_limited"
  | "auth_failed"
  | "invalid_response"
  | "parse_failed"
  | "upstream_error"
  | "fixture_fallback"
  | "database_write_forbidden";

export type NormalizedPublicDataItem = Record<string, string | number | boolean | null>;

export type NormalizedPublicDataBody = {
  items: NormalizedPublicDataItem[];
  pageNo: number | null;
  numOfRows: number | null;
  totalCount: number | null;
  rawFormat: "json" | "xml" | "fixture";
};

export type NormalizedPublicDataHeader = {
  resultCode: string | null;
  resultMsg: string | null;
};

export type NormalizedPublicDataResponse = {
  header: NormalizedPublicDataHeader;
  body: NormalizedPublicDataBody;
  ok: boolean;
};

export type PublicDataRequestParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type PublicDataClientConfig = {
  mode: PublicDataApiMode;
  /** Milliseconds before abort. */
  timeoutMs: number;
  /** Total attempts including the first try. */
  maxAttempts: number;
  /** Base delay for exponential backoff (ms). */
  retryBaseDelayMs: number;
  /** Cap for backoff delay (ms). */
  retryMaxDelayMs: number;
  hospitalInfo: {
    baseUrl: string;
    operations: {
      basisList: string;
    };
  };
  institutionDetail: {
    baseUrl: string;
    operations: {
      facilityInfo: string;
      departmentInfo: string;
    };
  };
};

export type SanitizedPublicDataError = {
  code: PublicDataErrorCode;
  messageKo: string;
  /** HTTP status when known; never includes secrets. */
  httpStatus: number | null;
  retryable: boolean;
  /** Always false — this client never writes to DB. */
  databaseTouched: false;
};

export type PublicDataCallMeta = {
  serviceId: PublicDataServiceId;
  operationId: PublicDataOperationId;
  mode: PublicDataApiMode;
  attempt: number;
  durationMs: number;
  /** Host + path only — query string with secrets never included. */
  safeEndpoint: string;
  rateLimited: boolean;
  usedFixture: boolean;
  databaseTouched: false;
  writeAttempted: false;
};

export type PublicDataCallResult = {
  ok: boolean;
  data: NormalizedPublicDataResponse | null;
  error: SanitizedPublicDataError | null;
  meta: PublicDataCallMeta;
};

export type ConnectivityProbeReport = {
  taskId: typeof PUBLIC_DATA_API_TASK_ID;
  mode: PublicDataApiMode;
  generatedAt: string;
  serviceKeyPresent: boolean;
  /** Hex fingerprint only — never the key itself. */
  serviceKeyFingerprint: string | null;
  authOk: boolean;
  seoulQueryOk: boolean;
  itemCount: number;
  sampleNames: string[];
  safeEndpoint: string | null;
  error: SanitizedPublicDataError | null;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  ok: boolean;
};

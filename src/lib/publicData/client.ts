/**
 * Secret-safe HTTP client for data.go.kr public APIs.
 * Timeouts, exponential backoff retries, rate-limit handling, fixture fallback.
 * Never logs authenticated URLs or service keys. Never writes to a database.
 */

import {
  joinServiceOperation,
  loadPublicDataClientConfig,
} from "./config";
import {
  buildInstitutionDepartmentFixture,
  buildInstitutionFacilityFixture,
  buildSeoulHospitalListFixture,
} from "./fixtures";
import {
  isAuthFailureResponse,
  isRateLimitResponse,
  normalizePublicDataPayload,
} from "./normalize";
import {
  buildSanitizedError,
  readDataGoKrServiceKey,
  toSafeEndpoint,
} from "./secrets";
import type {
  PublicDataCallResult,
  PublicDataClientConfig,
  PublicDataOperationId,
  PublicDataRequestParams,
  PublicDataServiceId,
  SanitizedPublicDataError,
} from "./types";

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers: { get(name: string): string | null };
}>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.2));
  return Math.min(maxMs, exp + jitter);
}

function appendParams(
  url: URL,
  params: PublicDataRequestParams,
  serviceKey: string,
): void {
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("_type", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    url.searchParams.set(k, String(v));
  }
}

function classifyHttpError(
  status: number,
  knownSecrets: string[],
): SanitizedPublicDataError {
  if (status === 401 || status === 403) {
    return buildSanitizedError("auth_failed", "인증이 거부되었습니다.", {
      httpStatus: status,
      retryable: false,
      knownSecrets,
    });
  }
  if (status === 429 || status === 503) {
    return buildSanitizedError(
      "rate_limited",
      "요청이 제한되었습니다. 잠시 후 재시도합니다.",
      { httpStatus: status, retryable: true, knownSecrets },
    );
  }
  if (status >= 500) {
    return buildSanitizedError("http_error", `업스트림 서버 오류(${status}).`, {
      httpStatus: status,
      retryable: true,
      knownSecrets,
    });
  }
  return buildSanitizedError("http_error", `HTTP 오류(${status}).`, {
    httpStatus: status,
    retryable: status === 408 || status === 425,
    knownSecrets,
  });
}

function resolveEndpoint(
  config: PublicDataClientConfig,
  serviceId: PublicDataServiceId,
  operationId: PublicDataOperationId,
): { serviceId: PublicDataServiceId; operationId: PublicDataOperationId; urlBase: string } {
  if (serviceId === "hira_hospital_info") {
    return {
      serviceId,
      operationId,
      urlBase: joinServiceOperation(
        config.hospitalInfo.baseUrl,
        config.hospitalInfo.operations.basisList,
      ),
    };
  }
  const op =
    operationId === "institution_department_info"
      ? config.institutionDetail.operations.departmentInfo
      : config.institutionDetail.operations.facilityInfo;
  return {
    serviceId,
    operationId,
    urlBase: joinServiceOperation(config.institutionDetail.baseUrl, op),
  };
}

function fixtureFor(
  operationId: PublicDataOperationId,
  params: PublicDataRequestParams,
) {
  if (operationId === "hospital_basis_list") {
    return buildSeoulHospitalListFixture();
  }
  const ykiho =
    typeof params.ykiho === "string" ? params.ykiho : "FIXTURE-YKIHO-SEOUL-001";
  if (operationId === "institution_department_info") {
    return buildInstitutionDepartmentFixture(ykiho);
  }
  return buildInstitutionFacilityFixture(ykiho);
}

export type PublicDataClientOptions = {
  env?: NodeJS.ProcessEnv;
  config?: Partial<PublicDataClientConfig>;
  fetchImpl?: FetchLike;
  /** When live fails and this is true, return fixture instead of hard error. */
  allowFixtureFallback?: boolean;
  now?: () => number;
};

export class PublicDataApiClient {
  private readonly env: NodeJS.ProcessEnv;
  private readonly config: PublicDataClientConfig;
  private readonly fetchImpl: FetchLike;
  private readonly allowFixtureFallback: boolean;
  private readonly now: () => number;

  constructor(opts: PublicDataClientOptions = {}) {
    this.env = opts.env ?? process.env;
    this.config = loadPublicDataClientConfig(this.env, opts.config);
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike);
    this.allowFixtureFallback = opts.allowFixtureFallback ?? true;
    this.now = opts.now ?? (() => Date.now());
  }

  getConfig(): PublicDataClientConfig {
    return this.config;
  }

  async call(
    serviceId: PublicDataServiceId,
    operationId: PublicDataOperationId,
    params: PublicDataRequestParams = {},
  ): Promise<PublicDataCallResult> {
    const started = this.now();
    const endpoint = resolveEndpoint(this.config, serviceId, operationId);
    const safeEndpoint = toSafeEndpoint(endpoint.urlBase);

    if (this.config.mode === "fixture") {
      const data = fixtureFor(operationId, params);
      return {
        ok: true,
        data,
        error: null,
        meta: {
          serviceId,
          operationId,
          mode: "fixture",
          attempt: 1,
          durationMs: Math.max(0, this.now() - started),
          safeEndpoint,
          rateLimited: false,
          usedFixture: true,
          databaseTouched: false,
          writeAttempted: false,
        },
      };
    }

    const serviceKey = readDataGoKrServiceKey(this.env);
    if (!serviceKey) {
      if (this.allowFixtureFallback) {
        const data = fixtureFor(operationId, params);
        return {
          ok: true,
          data,
          error: buildSanitizedError(
            "fixture_fallback",
            "서비스 키가 없어 fixture 모드로 대체했습니다.",
            { retryable: false },
          ),
          meta: {
            serviceId,
            operationId,
            mode: "fixture",
            attempt: 1,
            durationMs: Math.max(0, this.now() - started),
            safeEndpoint,
            rateLimited: false,
            usedFixture: true,
            databaseTouched: false,
            writeAttempted: false,
          },
        };
      }
      return {
        ok: false,
        data: null,
        error: buildSanitizedError(
          "missing_service_key",
          "DATA_GO_KR_SERVICE_KEY가 없습니다.",
          { retryable: false },
        ),
        meta: {
          serviceId,
          operationId,
          mode: "live",
          attempt: 0,
          durationMs: Math.max(0, this.now() - started),
          safeEndpoint,
          rateLimited: false,
          usedFixture: false,
          databaseTouched: false,
          writeAttempted: false,
        },
      };
    }

    const knownSecrets = [serviceKey];
    let lastError: SanitizedPublicDataError | null = null;
    let rateLimited = false;
    const maxAttempts = Math.max(1, this.config.maxAttempts);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const url = new URL(endpoint.urlBase);
      appendParams(url, params, serviceKey);
      // Build request URL in memory only — never log url.toString()
      const requestUrl = url.toString();

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );

      try {
        const res = await this.fetchImpl(requestUrl, {
          method: "GET",
          headers: { Accept: "application/json, application/xml, text/xml, */*" },
          signal: controller.signal,
        });
        clearTimeout(timer);

        const text = await res.text();
        if (!res.ok) {
          lastError = classifyHttpError(res.status, knownSecrets);
          rateLimited = lastError.code === "rate_limited";
          if (lastError.retryable && attempt < maxAttempts) {
            await sleep(
              backoffDelay(
                attempt,
                this.config.retryBaseDelayMs,
                this.config.retryMaxDelayMs,
              ),
            );
            continue;
          }
          break;
        }

        let normalized;
        try {
          normalized = normalizePublicDataPayload(text);
        } catch (parseErr) {
          lastError = buildSanitizedError(
            "parse_failed",
            `응답 파싱 실패: ${parseErr instanceof Error ? parseErr.message : "unknown"}`,
            { httpStatus: res.status, retryable: false, knownSecrets },
          );
          break;
        }

        if (isRateLimitResponse(res.status, normalized)) {
          rateLimited = true;
          lastError = buildSanitizedError(
            "rate_limited",
            "업스트림 요청 한도에 도달했습니다.",
            { httpStatus: res.status, retryable: true, knownSecrets },
          );
          if (attempt < maxAttempts) {
            await sleep(
              backoffDelay(
                attempt,
                this.config.retryBaseDelayMs,
                this.config.retryMaxDelayMs,
              ),
            );
            continue;
          }
          break;
        }

        if (isAuthFailureResponse(normalized) || !normalized.ok) {
          const auth = isAuthFailureResponse(normalized);
          lastError = buildSanitizedError(
            auth ? "auth_failed" : "upstream_error",
            auth
              ? "서비스 키 인증에 실패했습니다."
              : `업스트림 오류: ${normalized.header.resultMsg ?? normalized.header.resultCode ?? "unknown"}`,
            {
              httpStatus: res.status,
              retryable: !auth,
              knownSecrets,
            },
          );
          if (!auth && attempt < maxAttempts) {
            await sleep(
              backoffDelay(
                attempt,
                this.config.retryBaseDelayMs,
                this.config.retryMaxDelayMs,
              ),
            );
            continue;
          }
          break;
        }

        return {
          ok: true,
          data: normalized,
          error: null,
          meta: {
            serviceId,
            operationId,
            mode: "live",
            attempt,
            durationMs: Math.max(0, this.now() - started),
            safeEndpoint,
            rateLimited: false,
            usedFixture: false,
            databaseTouched: false,
            writeAttempted: false,
          },
        };
      } catch (err) {
        clearTimeout(timer);
        const aborted =
          err instanceof Error &&
          (err.name === "AbortError" || /aborted|timeout/i.test(err.message));
        lastError = buildSanitizedError(
          aborted ? "timeout" : "network",
          aborted
            ? "요청 시간이 초과되었습니다."
            : `네트워크 오류: ${err instanceof Error ? err.message : "unknown"}`,
          { retryable: true, knownSecrets },
        );
        if (attempt < maxAttempts) {
          await sleep(
            backoffDelay(
              attempt,
              this.config.retryBaseDelayMs,
              this.config.retryMaxDelayMs,
            ),
          );
          continue;
        }
        break;
      }
    }

    if (this.allowFixtureFallback && lastError) {
      const data = fixtureFor(operationId, params);
      return {
        ok: true,
        data,
        error: buildSanitizedError(
          "fixture_fallback",
          `라이브 호출 실패로 fixture로 대체했습니다. (${lastError.code})`,
          { httpStatus: lastError.httpStatus, retryable: false, knownSecrets },
        ),
        meta: {
          serviceId,
          operationId,
          mode: "fixture",
          attempt: maxAttempts,
          durationMs: Math.max(0, this.now() - started),
          safeEndpoint,
          rateLimited,
          usedFixture: true,
          databaseTouched: false,
          writeAttempted: false,
        },
      };
    }

    return {
      ok: false,
      data: null,
      error: lastError,
      meta: {
        serviceId,
        operationId,
        mode: "live",
        attempt: maxAttempts,
        durationMs: Math.max(0, this.now() - started),
        safeEndpoint,
        rateLimited,
        usedFixture: false,
        databaseTouched: false,
        writeAttempted: false,
      },
    };
  }

  /** Hospital basis list (getHospBasisList). */
  listHospitals(
    params: PublicDataRequestParams = {},
  ): Promise<PublicDataCallResult> {
    return this.call("hira_hospital_info", "hospital_basis_list", params);
  }

  /** Institution facility detail. */
  getFacilityInfo(ykiho: string): Promise<PublicDataCallResult> {
    return this.call("hira_institution_detail", "institution_facility_info", {
      ykiho,
    });
  }

  /** Institution department detail. */
  getDepartmentInfo(ykiho: string): Promise<PublicDataCallResult> {
    return this.call(
      "hira_institution_detail",
      "institution_department_info",
      { ykiho },
    );
  }
}

export function createPublicDataApiClient(
  opts?: PublicDataClientOptions,
): PublicDataApiClient {
  return new PublicDataApiClient(opts);
}

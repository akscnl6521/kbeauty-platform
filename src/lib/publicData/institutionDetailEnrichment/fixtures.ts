/**
 * Offline fixtures for institution detail enrichment (T07-03).
 */

import {
  HIRA_DEPT_INFO_SAFE_URL,
  HIRA_FACILITY_INFO_SAFE_URL,
} from "./constants";
import type {
  DetailFetchResponse,
  InstitutionDetailFetcher,
  InstitutionEnrichmentInputCandidate,
} from "./types";

type FixtureDetail = {
  ykiho: string;
  name: string;
  priorDepartmentCode?: string | null;
  priorDepartmentName?: string | null;
  departments: Array<{
    dgsbjtCd: string;
    dgsbjtCdNm: string;
    /** Omit or null → unknown specialist count. */
    dgsbjtPrSftCnt?: string | number | null;
  }>;
  /** Simulate fetch failure for this ykiho. */
  fail?: "retryable" | "terminal";
};

const FIXTURE_DETAILS: FixtureDetail[] = [
  {
    ykiho: "FIXTURE-YKIHO-SEOUL-DERM-001",
    name: "[FIXTURE] 서울 피부과 예시의원",
    priorDepartmentCode: "14",
    priorDepartmentName: "피부과",
    departments: [
      { dgsbjtCd: "14", dgsbjtCdNm: "피부과", dgsbjtPrSftCnt: "2" },
    ],
  },
  {
    ykiho: "FIXTURE-YKIHO-SEOUL-DERM-002",
    name: "[FIXTURE] 강남 피부과 예시클리닉",
    priorDepartmentCode: "14",
    priorDepartmentName: "피부과",
    departments: [
      { dgsbjtCd: "01", dgsbjtCdNm: "내과", dgsbjtPrSftCnt: "1" },
      { dgsbjtCd: "14", dgsbjtCdNm: "피부과", dgsbjtPrSftCnt: "3" },
    ],
  },
  {
    // Official derm but specialist count unknown
    ykiho: "FIXTURE-YKIHO-SEOUL-DERM-NOCOUNT-006",
    name: "[FIXTURE] 서울 피부과 인원미상",
    priorDepartmentCode: "14",
    priorDepartmentName: "피부과",
    departments: [{ dgsbjtCd: "14", dgsbjtCdNm: "피부과" }],
  },
  {
    // Marketing name only — no official derm
    ykiho: "FIXTURE-YKIHO-SEOUL-FAKE-DERM-NAME-005",
    name: "[FIXTURE] 마케팅용 피부과 간판 내과",
    priorDepartmentCode: "01",
    priorDepartmentName: "내과",
    departments: [
      { dgsbjtCd: "01", dgsbjtCdNm: "내과", dgsbjtPrSftCnt: "1" },
    ],
  },
  {
    // Prior list said derm; detail has no derm → conflict
    ykiho: "FIXTURE-YKIHO-CONFLICT-007",
    name: "[FIXTURE] 출처충돌 예시의원",
    priorDepartmentCode: "14",
    priorDepartmentName: "피부과",
    departments: [
      { dgsbjtCd: "01", dgsbjtCdNm: "내과", dgsbjtPrSftCnt: "2" },
    ],
  },
  {
    // Empty department payload
    ykiho: "FIXTURE-YKIHO-EMPTY-DEPT-008",
    name: "[FIXTURE] 진료과목 공백 예시",
    priorDepartmentCode: null,
    priorDepartmentName: null,
    departments: [],
  },
  {
    ykiho: "FIXTURE-YKIHO-RETRY-009",
    name: "[FIXTURE] 재시도 가능 실패 예시",
    departments: [],
    fail: "retryable",
  },
];

export function getFixtureEnrichmentCandidates(): InstitutionEnrichmentInputCandidate[] {
  return FIXTURE_DETAILS.map((d) => ({
    candidateId: `hira-seoul-derm-${d.ykiho}`,
    institutionId: d.ykiho,
    name: d.name,
    priorDepartmentCode: d.priorDepartmentCode ?? null,
    priorDepartmentName: d.priorDepartmentName ?? null,
    fixtureOnly: true,
  }));
}

export function createFixtureDetailFetcher(opts?: {
  details?: FixtureDetail[];
}): InstitutionDetailFetcher {
  const details = opts?.details ?? FIXTURE_DETAILS;

  return {
    async departments(ykiho: string): Promise<DetailFetchResponse> {
      const hit = details.find((d) => d.ykiho === ykiho);
      if (!hit) {
        return {
          ok: true,
          items: [],
          safeEndpoint: HIRA_DEPT_INFO_SAFE_URL,
          usedFixture: true,
          retryable: false,
          errorCode: null,
          errorMessageKo: null,
        };
      }
      if (hit.fail === "retryable") {
        return {
          ok: false,
          items: [],
          safeEndpoint: HIRA_DEPT_INFO_SAFE_URL,
          usedFixture: true,
          retryable: true,
          errorCode: "rate_limited",
          errorMessageKo: "요청이 제한되었습니다(fixture).",
        };
      }
      if (hit.fail === "terminal") {
        return {
          ok: false,
          items: [],
          safeEndpoint: HIRA_DEPT_INFO_SAFE_URL,
          usedFixture: true,
          retryable: false,
          errorCode: "auth_failed",
          errorMessageKo: "인증이 거부되었습니다(fixture).",
        };
      }
      return {
        ok: true,
        items: hit.departments.map((d) => ({
          ykiho,
          dgsbjtCd: d.dgsbjtCd,
          dgsbjtCdNm: d.dgsbjtCdNm,
          dgsbjtPrSftCnt:
            d.dgsbjtPrSftCnt === undefined ? null : d.dgsbjtPrSftCnt,
        })),
        safeEndpoint: HIRA_DEPT_INFO_SAFE_URL,
        usedFixture: true,
        retryable: false,
        errorCode: null,
        errorMessageKo: null,
      };
    },

    async facility(ykiho: string): Promise<DetailFetchResponse> {
      return {
        ok: true,
        items: [
          {
            ykiho,
            hghrSickbdCnt: "0",
            standardSickbdCnt: "0",
          },
        ],
        safeEndpoint: HIRA_FACILITY_INFO_SAFE_URL,
        usedFixture: true,
        retryable: false,
        errorCode: null,
        errorMessageKo: null,
      };
    },
  };
}

export { FIXTURE_DETAILS };

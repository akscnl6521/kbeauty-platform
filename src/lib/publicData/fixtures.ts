/**
 * Offline fixture payloads for HIRA-shaped hospital list / detail responses.
 * Fixture-only — never publishable; never writes to a database.
 */

import type { NormalizedPublicDataResponse } from "./types";

export const SEOUL_FIXTURE_HOSPITAL_NAMES = [
  "[FIXTURE] 서울 피부과 예시의원",
  "[FIXTURE] 강남 알레르기 클리닉 예시",
] as const;

export function buildSeoulHospitalListFixture(): NormalizedPublicDataResponse {
  return {
    ok: true,
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: {
      rawFormat: "fixture",
      pageNo: 1,
      numOfRows: 2,
      totalCount: 2,
      items: [
        {
          yadmNm: SEOUL_FIXTURE_HOSPITAL_NAMES[0],
          addr: "서울특별시 서초구 (fixture)",
          sidoCd: "110000",
          sidoCdNm: "서울",
          sgguCdNm: "서초구",
          telno: "02-0000-0000",
          clCdNm: "의원",
          ykiho: "FIXTURE-YKIHO-SEOUL-001",
        },
        {
          yadmNm: SEOUL_FIXTURE_HOSPITAL_NAMES[1],
          addr: "서울특별시 강남구 (fixture)",
          sidoCd: "110000",
          sidoCdNm: "서울",
          sgguCdNm: "강남구",
          telno: "02-0000-0001",
          clCdNm: "의원",
          ykiho: "FIXTURE-YKIHO-SEOUL-002",
        },
      ],
    },
  };
}

export function buildInstitutionFacilityFixture(
  ykiho = "FIXTURE-YKIHO-SEOUL-001",
): NormalizedPublicDataResponse {
  return {
    ok: true,
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: {
      rawFormat: "fixture",
      pageNo: 1,
      numOfRows: 1,
      totalCount: 1,
      items: [
        {
          ykiho,
          hghrSickbdCnt: "0",
          standardSickbdCnt: "0",
          adultChldSprmCnt: "0",
          soovCnt: "0",
        },
      ],
    },
  };
}

export function buildInstitutionDepartmentFixture(
  ykiho = "FIXTURE-YKIHO-SEOUL-001",
): NormalizedPublicDataResponse {
  return {
    ok: true,
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: {
      rawFormat: "fixture",
      pageNo: 1,
      numOfRows: 1,
      totalCount: 1,
      items: [
        {
          ykiho,
          dgsbjtCd: "04",
          dgsbjtCdNm: "피부과",
          dgsbjtPrSftCnt: "1",
        },
      ],
    },
  };
}

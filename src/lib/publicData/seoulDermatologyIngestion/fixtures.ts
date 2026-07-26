/**
 * Multi-page offline fixtures for Seoul dermatology ingestion (T07-02).
 * Includes Seoul derm, Seoul non-derm, non-Seoul, and intentional duplicates.
 */

import {
  HIRA_DEPT_INFO_SAFE_URL,
  HIRA_HOSP_LIST_SAFE_URL,
  SEOUL_SIDO_CD,
} from "./constants";
import type {
  DeptPageResponse,
  HospListPageRequest,
  HospListPageResponse,
  SeoulDermatologyPageFetcher,
} from "./types";

type FixtureHospital = {
  ykiho: string;
  yadmNm: string;
  addr: string;
  sidoCd: string;
  sidoCdNm: string;
  sgguCd: string;
  sgguCdNm: string;
  telno: string | null;
  clCd: string;
  clCdNm: string;
  XPos: string | null;
  YPos: string | null;
  estbDd: string | null;
  /** Official dept rows for getDgsbjtInfo */
  departments: Array<{ dgsbjtCd: string; dgsbjtCdNm: string }>;
};

const FIXTURE_HOSPITALS: FixtureHospital[] = [
  {
    ykiho: "FIXTURE-YKIHO-SEOUL-DERM-001",
    yadmNm: "[FIXTURE] 서울 피부과 예시의원",
    addr: "서울특별시 서초구 (fixture)",
    sidoCd: SEOUL_SIDO_CD,
    sidoCdNm: "서울",
    sgguCd: "110001",
    sgguCdNm: "서초구",
    telno: "02-0000-0001",
    clCd: "31",
    clCdNm: "의원",
    XPos: "127.0001",
    YPos: "37.4801",
    estbDd: "20150101",
    departments: [{ dgsbjtCd: "14", dgsbjtCdNm: "피부과" }],
  },
  {
    ykiho: "FIXTURE-YKIHO-SEOUL-DERM-002",
    yadmNm: "[FIXTURE] 강남 피부과 예시클리닉",
    addr: "서울특별시 강남구 (fixture)",
    sidoCd: SEOUL_SIDO_CD,
    sidoCdNm: "서울",
    sgguCd: "110002",
    sgguCdNm: "강남구",
    telno: "02-0000-0002",
    clCd: "31",
    clCdNm: "의원",
    XPos: "127.0280",
    YPos: "37.4970",
    estbDd: "20180315",
    departments: [
      { dgsbjtCd: "01", dgsbjtCdNm: "내과" },
      { dgsbjtCd: "14", dgsbjtCdNm: "피부과" },
    ],
  },
  {
    ykiho: "FIXTURE-YKIHO-SEOUL-ENT-003",
    yadmNm: "[FIXTURE] 서울 이비인후과 예시",
    addr: "서울특별시 마포구 (fixture)",
    sidoCd: SEOUL_SIDO_CD,
    sidoCdNm: "서울",
    sgguCd: "110003",
    sgguCdNm: "마포구",
    telno: "02-0000-0003",
    clCd: "31",
    clCdNm: "의원",
    XPos: "126.9100",
    YPos: "37.5500",
    estbDd: "20120101",
    departments: [{ dgsbjtCd: "13", dgsbjtCdNm: "이비인후과" }],
  },
  {
    ykiho: "FIXTURE-YKIHO-BUSAN-DERM-004",
    yadmNm: "[FIXTURE] 부산 피부과 예시",
    addr: "부산광역시 해운대구 (fixture)",
    sidoCd: "210000",
    sidoCdNm: "부산",
    sgguCd: "210001",
    sgguCdNm: "해운대구",
    telno: "051-000-0004",
    clCd: "31",
    clCdNm: "의원",
    XPos: "129.1600",
    YPos: "35.1600",
    estbDd: "20190101",
    departments: [{ dgsbjtCd: "14", dgsbjtCdNm: "피부과" }],
  },
  {
    // Duplicate of 001 by ykiho — tests deterministic dedupe
    ykiho: "FIXTURE-YKIHO-SEOUL-DERM-001",
    yadmNm: "[FIXTURE] 서울 피부과 예시의원 (재수집)",
    addr: "서울특별시 서초구 (fixture)",
    sidoCd: SEOUL_SIDO_CD,
    sidoCdNm: "서울",
    sgguCd: "110001",
    sgguCdNm: "서초구",
    telno: "02-0000-0001",
    clCd: "31",
    clCdNm: "의원",
    XPos: "127.0001",
    YPos: "37.4801",
    estbDd: "20150101",
    departments: [{ dgsbjtCd: "14", dgsbjtCdNm: "피부과" }],
  },
  {
    // Name contains 피부과 but no official dermatology dept
    ykiho: "FIXTURE-YKIHO-SEOUL-FAKE-DERM-NAME-005",
    yadmNm: "[FIXTURE] 마케팅용 피부과 간판 내과",
    addr: "서울특별시 종로구 (fixture)",
    sidoCd: SEOUL_SIDO_CD,
    sidoCdNm: "서울",
    sgguCd: "110004",
    sgguCdNm: "종로구",
    telno: "02-0000-0005",
    clCd: "31",
    clCdNm: "의원",
    XPos: "126.9800",
    YPos: "37.5700",
    estbDd: "20200101",
    departments: [{ dgsbjtCd: "01", dgsbjtCdNm: "내과" }],
  },
];

function toListItem(h: FixtureHospital): Record<string, string | number | boolean | null> {
  return {
    ykiho: h.ykiho,
    yadmNm: h.yadmNm,
    addr: h.addr,
    sidoCd: h.sidoCd,
    sidoCdNm: h.sidoCdNm,
    sgguCd: h.sgguCd,
    sgguCdNm: h.sgguCdNm,
    telno: h.telno,
    clCd: h.clCd,
    clCdNm: h.clCdNm,
    XPos: h.XPos,
    YPos: h.YPos,
    estbDd: h.estbDd,
  };
}

/**
 * Build a page fetcher over fixture hospitals.
 * When dgsbjtCd is set (e.g. "14"), only hospitals with that official dept are listed
 * (mirrors HIRA list filter behavior) — but pipeline still re-validates via dept API.
 */
export function createFixturePageFetcher(opts?: {
  /** Override full hospital list */
  hospitals?: FixtureHospital[];
}): SeoulDermatologyPageFetcher {
  const hospitals = opts?.hospitals ?? FIXTURE_HOSPITALS;

  return {
    async listPage(req: HospListPageRequest): Promise<HospListPageResponse> {
      let rows = hospitals;
      if (req.sidoCd) {
        rows = rows.filter((h) => h.sidoCd === req.sidoCd);
      }
      if (req.dgsbjtCd) {
        rows = rows.filter((h) =>
          h.departments.some((d) => d.dgsbjtCd === req.dgsbjtCd),
        );
      }
      // Deduplicate by ykiho for list pagination (API wouldn't return same id twice
      // across pages typically — keep duplicates adjacent for dedupe tests by
      // expanding after unique filter only when no dgsbjt filter... Actually we want
      // the duplicate row to appear for dedupe testing. Keep all rows including dup.)
      const totalCount = rows.length;
      const start = (req.pageNo - 1) * req.numOfRows;
      const slice = rows.slice(start, start + req.numOfRows);
      return {
        ok: true,
        items: slice.map(toListItem),
        pageNo: req.pageNo,
        numOfRows: req.numOfRows,
        totalCount,
        safeEndpoint: HIRA_HOSP_LIST_SAFE_URL,
        usedFixture: true,
        errorMessageKo: null,
      };
    },

    async departments(ykiho: string): Promise<DeptPageResponse> {
      const hit = hospitals.find((h) => h.ykiho === ykiho);
      if (!hit) {
        return {
          ok: true,
          items: [],
          safeEndpoint: HIRA_DEPT_INFO_SAFE_URL,
          usedFixture: true,
          errorMessageKo: null,
        };
      }
      return {
        ok: true,
        items: hit.departments.map((d) => ({
          ykiho,
          dgsbjtCd: d.dgsbjtCd,
          dgsbjtCdNm: d.dgsbjtCdNm,
          dgsbjtPrSftCnt: "1",
        })),
        safeEndpoint: HIRA_DEPT_INFO_SAFE_URL,
        usedFixture: true,
        errorMessageKo: null,
      };
    },
  };
}

export function getFixtureHospitalCount(): number {
  return FIXTURE_HOSPITALS.length;
}

export { FIXTURE_HOSPITALS };

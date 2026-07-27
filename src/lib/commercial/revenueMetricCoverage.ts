/**
 * MASTER_PLAN §38.8 «관리자 수익 대시보드» 가 요구하는 지표를, **지금 실제로
 * 셀 수 있는지** 기준으로 나눈다.
 *
 * 여기서 중요한 것은 «0» 과 «모름» 을 섞지 않는 것이다. 세 상태는 서로 다른
 * 사실이고, 대응하는 조치도 다르다.
 *
 *   collected  — 적재처가 있고 데이터도 있다. 숫자를 보여준다.
 *   empty      — 적재처는 있는데 아직 한 건도 안 들어왔다.
 *                («수익 0» 이 아니라 «아직 아무 일도 없었다»)
 *   uninstrumented — 적재처 자체가 없다. **수집을 안 하고 있다.**
 *                    0 으로 표시하면 «측정했더니 0» 으로 읽혀서 거짓이 된다.
 *
 * 지표를 억지로 채우지 않는다. 없는 것은 없다고 적는다.
 */

export type MetricStatus = "collected" | "empty" | "uninstrumented";

export type MetricCoverage = {
  /** §38.8 에 적힌 지표 이름 */
  metric: string;
  /** 이 지표를 세려면 있어야 하는 테이블 */
  source: string;
  status: MetricStatus;
  /** collected 일 때만 채운다 */
  count: number | null;
};

/**
 * §38.8 지표와 적재처의 대응. 지표 이름은 계획서 표기를 그대로 쓴다 —
 * 여기서 이름을 바꾸면 «무엇이 아직 없는지» 를 대조하기 어려워진다.
 */
export const METRIC_SOURCES: ReadonlyArray<{ metric: string; source: string }> = [
  { metric: "제품 클릭률", source: "commercial_click_events" },
  { metric: "판매처 클릭률", source: "commercial_click_events" },
  { metric: "구매 전환율", source: "commercial_click_events" },
  { metric: "제휴 매출", source: "commercial_click_events" },
  { metric: "Sponsored 노출", source: "commercial_click_events" },
  { metric: "국가별 성과", source: "commercial_click_events" },
  { metric: "3·7·15·30일 응답률", source: "care_check_ins" },
  { metric: "Organic 추천 노출", source: "recommendation_impressions" },
  { metric: "병원 상담 클릭", source: "clinic_click_events" },
  { metric: "병원 리드", source: "clinic_click_events" },
  { metric: "예약 전환", source: "clinic_inquiries" },
  { metric: "광고 노출과 수익", source: "ad_impressions" },
  { metric: "재방문율", source: "user_sessions" },
  { metric: "제품 만족도", source: "product_feedback" },
  { metric: "상담 만족도", source: "clinic_feedback" },
];

/**
 * 적재처별 조회 결과(행 수 또는 «테이블 없음»)를 지표 목록에 입힌다.
 *
 * `counts` 에 없는 적재처는 «확인하지 않았다» 가 아니라 «없다» 로 본다 —
 * 호출자가 모든 적재처를 조회하고 넘기는 것을 전제로 한다.
 */
export function resolveMetricCoverage(
  counts: ReadonlyMap<string, number | null>
): MetricCoverage[] {
  return METRIC_SOURCES.map(({ metric, source }) => {
    const n = counts.get(source);
    if (n == null) return { metric, source, status: "uninstrumented", count: null };
    if (n === 0) return { metric, source, status: "empty", count: 0 };
    return { metric, source, status: "collected", count: n };
  });
}

export function summarizeCoverage(rows: readonly MetricCoverage[]): {
  collected: number;
  empty: number;
  uninstrumented: number;
} {
  return {
    collected: rows.filter((r) => r.status === "collected").length,
    empty: rows.filter((r) => r.status === "empty").length,
    uninstrumented: rows.filter((r) => r.status === "uninstrumented").length,
  };
}

export const METRIC_STATUS_LABEL_KO: Record<MetricStatus, string> = {
  collected: "수집 중",
  empty: "적재처 있음 · 0건",
  uninstrumented: "수집 안 함",
};
